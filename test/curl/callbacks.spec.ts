/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import 'should'

import { Curl, CurlCode } from '../../lib'

let curl: Curl

const url = 'http://example.com'

describe('Callbacks', () => {
  beforeEach(() => {
    curl = new Curl()
  })

  afterEach(() => {
    curl.close()
  })

  if (Curl.isVersionGreaterOrEqualThan(7, 64, 0)) {
    describe('trailer', function() {
      this.timeout(5000)

      it('should abort request on false', done => {
        curl.setOpt('URL', `${url}/headers`)
        curl.setOpt('UPLOAD', true)
        curl.setOpt('HTTPHEADER', ['x-random-header: random-value'])
        curl.setOpt('TRAILERFUNCTION', () => {
          return false
        })
        curl.on('end', () => {
          done(new Error('end called - request wast not aborted by request'))
        })

        curl.on('error', (error, errorCode) => {
          errorCode.should.be.equal(CurlCode.CURLE_ABORTED_BY_CALLBACK)
          done()
        })

        curl.perform()
      })

      it('should throw an error on invalid return value', done => {
        curl.setOpt('URL', `${url}/headers`)
        curl.setOpt('UPLOAD', true)
        curl.setOpt('HTTPHEADER', ['x-random-header: random-value'])
        // @ts-ignore
        curl.setOpt('TRAILERFUNCTION', () => {
          return {}
        })

        curl.on('end', () => {
          done(new Error('end called - request wast not aborted by request'))
        })

        curl.on('error', (error, errorCode) => {
          error.should.be.equal(
            'Operation was aborted by an application callback',
          )

          if (errorCode) {
            errorCode.should.be.equal(CurlCode.CURLE_ABORTED_BY_CALLBACK)
          }

          done()
        })

        curl.perform()
      })
    })
  }
})
