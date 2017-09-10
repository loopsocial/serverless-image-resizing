'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

function resizeImage(data, width, height, format) {
  return Sharp(data.Body)
  .resize(width, height)
  .max()
  .toFormat(format)
  .toBuffer()
}

function resizeThumbnail(data, width, height, format) {
  return Sharp(data.Body)
  .resize(width, height)
  .crop()
  .toFormat(format)
  .toBuffer()
}

function format(extension) {
  switch(extension) {
    case "png":
      return "png";
    case "jpeg":
      return "jpeg";
    case "jpg":
      return "jpeg";
  }
}

function parseQuery(key) {
  const match = key.match(/(.*)\/(\d+)(x|_)(\d+)\/(.*)\.(png|jpeg|jpg)/);
  if (match) {
    return {
      key: key,
      width: parseInt(match[2], 10),
      height: parseInt(match[4], 10),
      format: format(match[6]),
      crop: match[3] === '_',
      originalKey: `${match[1]}/original/${match[5]}.${match[6]}`
    };
  } else {
    return null;
  }
}

exports.handler = function(event, context, callback) {
  const q = parseQuery(event.queryStringParameters.key);

  if (q) {
    S3.getObject({Bucket: BUCKET, Key: q.originalKey}).promise()
    .then(data => {
      if (q.crop) {
        return resizeThumbnail(data, q.width, q.height, q.format)
      } else {
        return resizeImage(data, q.width, q.height, q.format)
      }
    })
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: `image/${q.format}`,
        CacheControl: 'max-age=12312312',
        Key: q.key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${q.key}`},
        body: '',
      })
    )
    .catch(err => callback(err))
  } else {
    callback(null, {
      statusCode: '404',
      body: ''
    })
  }

}
