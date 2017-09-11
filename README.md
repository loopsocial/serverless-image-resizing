# Serverless Image Resizing

## Description

Resizes images on the fly using Amazon S3, AWS Lambda, and Amazon API Gateway. Using a conventional URL structure and S3 static website hosting with redirection rules, requests for resized images are redirected to a Lambda function via API Gateway which will resize the image, upload it to S3, and redirect the requestor to the resized image. The next request for the resized image will be served from S3 directly.

## Usage

1. Deploy the CloudFormation stack

  Run `bin/deploy [prod|sandbox]` to deploy the CloudFormation stack. It will create a temporary Amazon S3 bucket, package and upload the function, and create the Lambda function, Amazon API Gateway RestApi, and an S3 bucket for images via CloudFormation.

  The deployment script requires the [AWS CLI][cli] version 1.11.19 or newer to be installed.

1. Test the function

	Upload an image to the S3 bucket and try to resize it via your web browser to different sizes, e.g. with an image uploaded in the bucket called image.png:

	- http://[BucketWebsiteHost]/300x300/image.png
	- http://[BucketWebsiteHost]/90x90/image.png
	- http://[BucketWebsiteHost]/40x40/image.png

	You can find the BucketWebsiteUrl in the table of outputs displayed on a successful invocation of the deploy script.

1. Using CloudFront to serve files in SSL
  
  Step 1. Create CloudFront Distribution
  Go to CloudFront Distributions and Create Distribution
  Select Web
  For Original Domain Name, do not use S3 autocomplete, use the S3 static site URL
  Click "Create Distribution"

  Step 2. Create Behaviors
  In Behaviors tab, click "Create Behavior"
  Enter "*/*.jpg" for the Path Pattern
  Set Default TTL to 0
  Click "Create"
  Repeat for "*/*.png" and "*/*.jpeg"

  Step 3. Update Lambda Environment
  Copy the Domain Name in CloudFront
  Go to Lambda/Functions, select the lambda function, in the Environment variables section, set URL to the CLoudFront domain



**Note:** If you create the Lambda function yourself, make sure to select Node.js version 6.10.

## License

This reference architecture sample is [licensed][license] under Apache 2.0.

[license]: LICENSE
[sharp]: https://github.com/lovell/sharp
[amazon-linux]: https://aws.amazon.com/blogs/compute/nodejs-packages-in-lambda/
[cli]: https://aws.amazon.com/cli/
