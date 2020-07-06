.PHONY: all image package dist clean

all: package

image:
	docker build --tag amazonlinux:nodejs .

package_old: image
	docker run --rm --volume ${PWD}/lambda:/build amazonlinux:nodejs npm install --production

package:
	docker run --rm --volume ${PWD}/lambda:/var/task lambci/lambda:build-nodejs12.x npm install --production

dist: package
	cd lambda && zip -FS -q -r ../dist/function.zip *

clean:
	rm -r lambda/node_modules
	docker rmi --force amazonlinux:nodejs
