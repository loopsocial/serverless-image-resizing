"use strict";

const AWS = require("aws-sdk");
const S3 = new AWS.S3({
  signatureVersion: "v4",
});
const Sharp = require("sharp");

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

function resizeImage(data, options) {
  return Sharp(data.Body)
    .rotate()
    .resize(options.width, options.height, { fit: "inside" })
    .toFormat(options.format, { quality: options.quality })
    .toBuffer();
}

function resizeThumbnail(data, options) {
  return Sharp(data.Body)
    .rotate()
    .resize(options.width, options.height, {
      fit: "cover",
      position: "attention",
    })
    .toFormat(options.format, { quality: options.quality })
    .toBuffer();
}

function format(extension) {
  switch (extension.toLowerCase()) {
    case "png":
      return "png";
    case "jpeg":
      return "jpeg";
    case "jpg":
      return "jpeg";
    case "webp":
      return "webp";
  }
}

function parseQuery(key) {
  const match = key.match(
    // medias/2019/8/23/1566543539-pxcgzkoi/540_960/IMG_20190413_232558.jpg.webp
    // 	-> medias/2019/8/23/1566543539-pxcgzkoi/original/IMG_20190413_232558.jpg
    /(?<originalKey>.*\/(?<sizePart>(?<width>\d+)(?<cropOrFit>x|_)(?<height>\d+))\/.*\.(?<sourceFormat>png|jpeg|jpg))(\.(?<quality>[0-9]{2}))?(\.(?<destFormat>png|jpeg|jpg|webp))?/i
  );
  const match2 = key.match(
    // medias/2019/10/1/1569974287-ofqhpmiw/transcoded/120/margauxfacetransformatioon2.png.wepb
    // 	-> medias/2019/10/1/1569974287-ofqhpmiw/transcoded/540/margauxfacetransformatioon2.png
    /(?<originalKey>.*\/transcoded\/(?<width>\d+)\/.*\.(?<sourceFormat>png|jpeg|jpg))(\.(?<quality>[0-9]{2}))?(\.(?<destFormat>png|jpeg|jpg|webp))?/i
  );
  if (match) {
    return {
      key: key,
      width: parseInt(match.groups.width, 10),
      height: parseInt(match.groups.height, 10),
      format: match.groups.destFormat
        ? format(match.groups.destFormat)
        : format(match.groups.sourceFormat),
      crop: match.groups.cropOrFit === "_",
      quality: match.groups.quality
        ? parseInt(match.groups.quality, 10)
        : undefined,
      originalKey: match.groups.originalKey.replace(
        `/${match.groups.sizePart}/`,
        "/original/"
      ),
    };
  } else if (match2) {
    return {
      key: key,
      width: parseInt(match2.groups.width, 10),
      height: parseInt(match2.groups.width * 1.7777777778, 10), // 540x960 ratio
      format: match2.groups.destFormat
        ? format(match2.groups.destFormat)
        : format(match2.groups.sourceFormat),
      crop: true,
      quality: match2.groups.quality
        ? parseInt(match2.groups.quality, 10)
        : undefined,
      originalKey: match2.groups.originalKey.replace(
        `/${match2.groups.width}/`,
        "/540/"
      ),
    };
  } else {
    return null;
  }
}

exports.handler = function (event, context, callback) {
  const q = parseQuery(event.queryStringParameters.key);

  if (q) {
    // console.log(`processing ${q.originalKey}`, JSON.stringify(q));
    S3.getObject({ Bucket: BUCKET, Key: q.originalKey })
      .promise()
      .then((data) =>
        q.crop ? resizeThumbnail(data, q) : resizeImage(data, q)
      )
      .then((buffer) =>
        S3.putObject({
          Body: buffer,
          Bucket: BUCKET,
          ContentType: `image/${q.format}`,
          CacheControl: "max-age=12312312",
          Key: q.key,
        }).promise()
      )
      .then(() =>
        callback(null, {
          statusCode: "301",
          headers: { location: `${URL}/${q.key}` },
          body: "",
        })
      )
      .catch((err) => callback(err));
  } else {
    callback(null, {
      statusCode: "404",
      body: "",
    });
  }
};
