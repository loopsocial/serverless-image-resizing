"use strict";

const AWS = require("aws-sdk");
const S3 = new AWS.S3({
  signatureVersion: "v4",
});
const Sharp = require("sharp");
const ImageMagick = require("imagemagick");

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

function isWebpAnimated(data) {
  return data.toString().substring(0, 256).includes("WEBPVP8X");
}

function resizeImage(data, options) {
  if (
    "gif" === options.sourceFormat ||
    ("webp" === options.sourceFormat &&
      "webp" === options.format &&
      isWebpAnimated(data.Body))
  ) {
    return new Promise((resolve, reject) => {
      ImageMagick.resize(
        {
          srcFormat: options.sourceFormat,
          srcData: data.Body,
          format: options.format,
          width: options.width,
          height: options.height,
        },
        (err, stdout, stderr) => {
          err ? reject(stderr) : resolve(new Buffer(stdout, "binary"));
        }
      );
    });
  }
  return Sharp(data.Body)
    .rotate()
    .resize(options.width, options.height, { fit: "inside" })
    .toFormat(options.format, { quality: options.quality })
    .toBuffer();
}

function resizeThumbnail(data, options) {
  if (
    "gif" === options.sourceFormat ||
    ("webp" === options.sourceFormat &&
      "webp" === options.format &&
      isWebpAnimated(data.Body))
  ) {
    return new Promise((resolve, reject) => {
      ImageMagick.resize(
        {
          srcFormat: options.sourceFormat,
          srcData: data.Body,
          format: options.format,
          width: options.width,
          height: options.height,
          crop: "center",
        },
        (err, stdout, stderr) => {
          err ? reject(stderr) : resolve(new Buffer(stdout, "binary"));
        }
      );
    });
  }
  return Sharp(data.Body)
    .rotate()
    .resize(options.width, options.height, {
      fit: "cover",
    })
    .toFormat(options.format, { quality: options.quality })
    .toBuffer();
}

function format(extension) {
  const lowercased = extension.toLowerCase();
  switch (lowercased) {
    case "jpg":
      return "jpeg";
    default:
      return lowercased;
  }
}

function parseQuery(key) {
  const match = key.match(
    // medias/2019/8/23/1566543539-pxcgzkoi/540_960/IMG_20190413_232558.jpg.webp
    // 	-> medias/2019/8/23/1566543539-pxcgzkoi/original/IMG_20190413_232558.jpg
    /(?<originalKey>.*\/(?<sizePart>(?<width>\d+)(?<cropOrFit>x|_)(?<height>\d+))\/.*?\.(?<sourceFormat>png|jpeg|jpg|gif|webp))(\.(?<quality>[0-9]{2}))?(\.(?<destFormat>png|jpeg|jpg|gif|webp))?/i
  );
  const match2 = key.match(
    // medias/2019/10/1/1569974287-ofqhpmiw/transcoded/120/margauxfacetransformatioon2.png.wepb
    // 	-> medias/2019/10/1/1569974287-ofqhpmiw/transcoded/540/margauxfacetransformatioon2.png
    /(?<originalKey>.*\/transcoded\/(?<width>\d+)\/.*?\.(?<sourceFormat>png|jpeg|jpg|gif|webp))(\.(?<quality>[0-9]{2}))?(\.(?<destFormat>png|jpeg|jpg|gif|webp))?/i
  );
  if (match) {
    return {
      key: key,
      width: parseInt(match.groups.width, 10),
      height: parseInt(match.groups.height, 10),
      format: match.groups.destFormat
        ? format(match.groups.destFormat)
        : format(match.groups.sourceFormat),
      sourceFormat: match.groups.sourceFormat,
      crop: match.groups.cropOrFit === "_",
      quality: match.groups.quality
        ? parseInt(match.groups.quality, 10)
        : undefined,
      originalKeys: [
        match.groups.originalKey.replace(
          `/${match.groups.sizePart}/`,
          "/original/"
        ),
      ],
    };
  } else if (match2) {
    return {
      key: key,
      width: parseInt(match2.groups.width, 10),
      height: parseInt(match2.groups.width * 1.7777777778, 10), // 540x960 ratio
      format: match2.groups.destFormat
        ? format(match2.groups.destFormat)
        : format(match2.groups.sourceFormat),
      sourceFormat: match.groups.sourceFormat,
      crop: true,
      quality: match2.groups.quality
        ? parseInt(match2.groups.quality, 10)
        : undefined,
      originalKeys: [
        match2.groups.originalKey.replace(`/${match2.groups.width}/`, "/540/"),
        match2.groups.originalKey.replace(`/${match2.groups.width}/`, "/000/"),
      ],
    };
  } else {
    return null;
  }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    const breakLoop = await callback(array[index], index, array);
    if (breakLoop) break;
  }
}

exports.handler = function (event, context, callback) {
  const params = parseQuery(event.queryStringParameters.key);
  console.log(
    `processing ${event.queryStringParameters.key}`,
    JSON.stringify(params)
  );

  if (params) {
    (async () => {
      const errors = [];
      await asyncForEach(params.originalKeys, async (originalKey) => {
        try {
          const originalS3object = await S3.getObject({
            Bucket: BUCKET,
            Key: originalKey,
          }).promise();

          const buffer = params.crop
            ? await resizeThumbnail(originalS3object, params)
            : await resizeImage(originalS3object, params);

          await S3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            ContentType: `image/${params.format}`,
            CacheControl: "max-age=12312312",
            Key: params.key,
          }).promise();

          callback(null, {
            statusCode: "301",
            headers: { location: `${URL}/${params.key}` },
            body: "",
          });

          return true;
        } catch (err) {
          errors.push(err);
        }
        return false;
      });

      callback(errors);
    })();
  } else {
    callback(null, {
      statusCode: "404",
      body: "",
    });
  }
};
