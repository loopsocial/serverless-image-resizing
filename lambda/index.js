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
    /(.*)\/(\d+)(x|_)(\d+)\/(.*)\.(png|jpeg|jpg)(\.([0-9]{2}))?(\.(png|jpeg|jpg|webp))?/i
  );
  if (match) {
    return {
      key: key,
      width: parseInt(match[2], 10),
      height: parseInt(match[4], 10),
      format: match[10] ? format(match[10]) : format(match[6]),
      crop: match[3] === "_",
      quality: match[8] ? parseInt(match[8], 10) : undefined,
      originalKey: `${match[1]}/original/${match[5]}.${match[6]}`,
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
