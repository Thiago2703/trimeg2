/* The pure browser bundle of MegaNzApi 0.2.0, License MIT (https://github.com/alttiri/meganz-api/blob/master/LICENSE). It requires CryptoJS. */
var Mega = (function (exports, Util$1, MegaUtil$1, synchronization_js, GroupedTasks$1) {
    'use strict';

    Util$1 = Util$1 && Object.prototype.hasOwnProperty.call(Util$1, 'default') ? Util$1['default'] : Util$1;
    MegaUtil$1 = MegaUtil$1 && Object.prototype.hasOwnProperty.call(MegaUtil$1, 'default') ? MegaUtil$1['default'] : MegaUtil$1;
    GroupedTasks$1 = GroupedTasks$1 && Object.prototype.hasOwnProperty.call(GroupedTasks$1, 'default') ? GroupedTasks$1['default'] : GroupedTasks$1;

    class Util {

        /**
         * @param {string} base64
         * @returns {string} binaryString
         */
        static base64ToBinaryString(base64) {
            try {
                return atob(base64);
            } catch (e) {
                console.error("Incorrect Base64:", base64);
                throw e;
            }
        }

        /**
         * @param {string} binaryString
         * @returns {string} base64
         */
        static binaryStringToBase64(binaryString) {
            return btoa(binaryString);
        }

        /**
         * @param {TypedArray|ArrayBuffer|DataView} arrayBuffer
         * @returns {string}
         */
        static arrayBufferToUtf8String(arrayBuffer) {
            return new TextDecoder().decode(arrayBuffer);
        }

        /**
         * To binary string (Latin1).
         *
         * NB: A binary string is a string is encoded with "Latin1" ("ISO-8859-1", not "Windows−1252"!).
         * `TextDecoder` does not support decoding "Latin1", "ISO-8859-1".
         * ```
         * const str = new TextDecoder("ISO-8859-1").decode(new Uint8Array([148, 125, 1, 218, 233, 169, 248, 111]));
         * console.log(str[0], str[0].charCodeAt(0)); // "”" 8221 (!)
         * const result = Uint8Array.from(str.split(""), ch => ch.charCodeAt(0));
         * console.log(result);
         * // [29, 125, 1, 218, 233, 169, 248, 111] // 29 (!) (trims `8221` to one byte)
         * ```
         * UPD:
         * Well, it works not so good as I expected
         * ```
         * String.fromCharCode(...new Uint8Array(125830)) // OK
         * String.fromCharCode(...new Uint8Array(125831)) // RangeError: Maximum call stack size exceeded
         * ```
         * Replaced with `reduce`. It works OK, no need to optimise (like `Util.arrayBufferToHexString()`).
         *
         * Also:
         * new TextDecoder("utf-8").decode(new Uint8Array([128])).charCodeAt(0) === 65533 "�"
         * new TextDecoder("Latin1").decode(new Uint8Array([128])).charCodeAt(0) === 8364 "€"
         * String.fromCharCode(128).charCodeAt(0) === 128 ""
         *
         * @param {Uint8Array} arrayBuffer
         * @returns {string} binaryString
         * */
        static arrayBufferToBinaryString(arrayBuffer) {
            return arrayBuffer.reduce((accumulator, byte) => accumulator + String.fromCharCode(byte), "");
        }

        /**
         * Do not use `new TextEncoder().encode(binaryStr)` for binary (Latin1) strings.
         * It maps code points to utf8 bytes (so char codes of 128-255 range maps to 2 bytes, not 1).
         * For example: String.fromCharCode(128) is mapped to [194, 128] bytes
         *
         * The current implementation works x2-4 times faster than:
         * `Uint8Array.from(binaryString.split(""), ch => ch.charCodeAt(0))`
         *
         * @param {string} binaryString
         * @returns {Uint8Array} u8Array
         */
        static binaryStringToArrayBuffer(binaryString) {
            const u8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                u8Array[i] = binaryString.charCodeAt(i);
            }
            return u8Array;
        }

        /**
         * Binary string (Latin1) encoded with Base64 to ArrayBuffer
         * @param {string} base64
         * @returns {Uint8Array}
         */
        static base64ToArrayBuffer(base64) {
            const binaryString = Util.base64ToBinaryString(base64);
            return Util.binaryStringToArrayBuffer(binaryString);
        }

        /**
         * ArrayBuffer to Base64 encoded binary string (Latin1)
         * @param {Uint8Array} arrayBuffer
         * @returns {string}
         */
        static arrayBufferToBase64(arrayBuffer) {
            const binaryString = Util.arrayBufferToBinaryString(arrayBuffer);
            return Util.binaryStringToBase64(binaryString);
        }

        /**
         * The optimised version
         * @param {TypedArray} arrayBuffer
         * @returns {string}
         */
        static arrayBufferToHexString(arrayBuffer) {
            const byteToHex = Util.ByteToHexTable.get();

            const buffer = new Uint8Array(arrayBuffer.buffer);
            const hexOctets = new Array(buffer.length);

            for (let i = 0; i < buffer.length; i++) {
                hexOctets[i] = byteToHex[buffer[i]];
            }

            return hexOctets.join("");
        }

        /**
         * Allows to get the precomputed hex octets table (the array)
         *
         * `[0]: "00"`
         * ...
         * `[255]: "FF"`
         *
         * It is used only in `Util.arrayBufferToHexString()`. Lazy loading.
         * @private
         */
        static ByteToHexTable = class {
            static get() {
                const self = Util.ByteToHexTable;
                if (!self.inited) {
                    self.init();
                }
                return self.byteToHex;
            }
            static byteToHex = [];
            static inited = false;
            static init = () => {
                const self = Util.ByteToHexTable;
                for (let i = 0; i < 256; i++) {
                    const hexOctet = i.toString(16).padStart(2, "0");
                    self.byteToHex.push(hexOctet);
                }
                self.inited = true;
            }
        }



        /**
         * Array of bytes (Little-endian) to Long (64-bits) value
         * @param {Uint8Array} arrayBuffer
         * @returns {number}
         */
        static arrayBufferToLong(arrayBuffer) {
            const sizeofLong = 8; // in fact max integer value in JS has 7 bytes, see Number.MAX_SAFE_INTEGER

            if (arrayBuffer.length > sizeofLong) {
                throw "Length is over size of Long";
            }

            const result = arrayBuffer.reduce((previousValue, currentValue, index) => {
                return previousValue + currentValue * (256 ** index);
            }, 0);

            if (result > Number.MAX_SAFE_INTEGER) { // > 9007199254740991 === 00 1F FF FF  FF FF FF FF
                throw "Over Number.MAX_SAFE_INTEGER";
            }

            return result;
        }

        /**
         * 1436853891 -> "2015.07.14 09:04:51"
         * @param {number} seconds
         * @returns {string}
         */
        static secondsToFormattedString(seconds) {
            const date = new Date(seconds * 1000);

            // Adds zero padding
            function pad(str) {
                return str.toString().padStart(2, "0");
            }

            return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) + " " +
                pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
        }

        /**
         * Format bytes to human readable format
         * Trims the tailing zeros
         *
         * {@link https://stackoverflow.com/a/18650828/11468937}
         * @see MegaUtil.bytesToSize
         * @param {number} bytes
         * @param {number} [decimals=2]
         * @returns {string}
         */
        static bytesToSize(bytes, decimals = 2) {
            if (bytes === 0) {
                return "0 B";
            }
            const k = 1024;
            decimals = decimals < 0 ? 0 : decimals;
            const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
        }

        /**
         * @example
         * await Util.sleep(50);
         *
         * @param {number} ms milliseconds
         * @param {boolean} inNextEventLoopTask - if passed 0 wait for the next event loop task, or no (use micro task)
         * @returns {Promise}
         */
        static sleep(ms, inNextEventLoopTask = false) {  //todo rework (true be default)
            if (ms <= 0) {
                if (inNextEventLoopTask) {
                    return Util.nextEventLoopTask();
                } else {
                    return Promise.resolve(); // It's not the same thing as using `setImmediate`
                }
            }
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Return a promise that fulfills at the next event loop task
         * Use to split a long time work to multiple tasks
         *
         * @example
         * doWorkPart1();
         * await Util.nextEventLoopTask();
         * doWorkPart2();
         *
         * @returns {Promise}
         */
        static nextEventLoopTask() {
            return new Promise(resolve => {
                Util.setImmediate(resolve);
            });
        }

        /**
         * Transforms an object like this: `{"n": "e1ogxQ7T"}` to `"n=e1ogxQ7T"`
         * and adds it to the url as search params. The example result: `${url}?n=e1ogxQ7T`.
         *
         * @param {URL} url
         * @param {Object} searchParams
         */
        static addSearchParamsToURL(url, searchParams) {
            Object.entries(searchParams).forEach(([key, value]) => {
                url.searchParams.append(key, value.toString());
            });
        }

        /**
         * @param {function} executable - an async function to repeat if it throws an exception
         * @param {number} count=5 - count of the repeats
         * @param {number} delay=5000 - ms to wait before repeating
         * @return {Promise<*>}
         */
        static async repeatIfErrorAsync(executable, count = 5, delay = 5000) { //todo make `delay` iterable
            for (let i = 0;; i++) {
                try {
                    if (i) {
                        console.log("REPEAT");
                    }
                    return await executable();
                } catch (e) {
                    console.error(e, `ERROR! Will be repeated. The try ${i + 1} of ${count}.`);
                    if (i < count) {
                        await Util.sleep(delay);
                    } else {
                        throw e;
                    }
                }
            }
        }

        /**
         * @param {string} name
         * @return {string}
         */
        static getSafeName(name) {
            //todo implement this:
            // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file
            if (name.includes("/")) {
                console.log(`Bad filename: "${name}"`); // for debugging currently
            }
            return name.replace("/", "_");
        }
        //todo isSafeName() - the similar method

        /**
         * The simple implementation
         * @param {Array|TypedArray} array1
         * @param {Array|TypedArray} array2
         * @return {boolean}
         */
        static compareArrays(array1, array2) {
            if (array1.length === array2.length) {
                for (let i = 0; i < array1.length; i++) {
                    if (array1[i] !== array2[i]) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }

        /**
         * Convert the string to the base64 encoded utf-8 bytes.
         *
         * With default mode "default" it uses `unescape` function that is deprecated now,
         * but it works much faster than converting with "safe" mode (ArrayBuffer -> binaryString -> base64).
         * With "unsafe" mode the sting must be Latin1 encoded, or you get the exception in a browser
         * ("DOMException: Failed to execute 'btoa' on 'Window':
         *     the string to be encoded contains characters outside of the Latin1 range.") or the wrong result in Node.js.
         *
         * For node.js you can use:
         * `Buffer.from(string).toString("base64")`
         *
         * @param {string} string
         * @param {"default"|"safe"|"unsafe"} [mode="default"]
         * @returns {string} base64
         */
        static stringToBase64(string, mode = "default") {
            if (mode === "default") {       // uses deprecated `escape` function
                const binaryString = unescape(encodeURIComponent(string));
                return Util.binaryStringToBase64(binaryString);
            } else if (mode === "safe") {   // works slower (~3x)
                const arrayBuffer = new TextEncoder().encode(string);
                return Util.arrayBufferToBase64(arrayBuffer);
            } else if (mode === "unsafe") { // only for Latin1 within Base64
                return Util.binaryStringToBase64(string);
            }
        }

        /**
         * Convert the Base64 encoded string of utf-8 bytes to the string.
         *
         * @param {string} base64
         * @param {"default"|"safe"|"unsafe"} [mode="default"]
         * @returns {string}
         */
        static base64ToString(base64, mode = "default") {
            if (mode === "default") {       // uses deprecated `escape` function
                const binaryString = Util.base64ToBinaryString(base64);
                return decodeURIComponent(escape(binaryString));
            } else if (mode === "safe") {   // works slower (~x4+)
                const arrayBuffer = Util.base64ToArrayBuffer(base64);
                return new TextDecoder().decode(arrayBuffer);
            } else if (mode === "unsafe") { // only for Latin1 within Base64
                return Util.base64ToBinaryString(base64);
            }
        }

        /**
         * Make ReadableStream iterable
         *
         * @example
         *  for await (const chunk of iterateReadableStream(stream)) {
         *      i++;                 // If you do not want to block event loop.
         *      if (i % 128 === 0) { // Note: it has negative impact for performance: ~7 %, without `if`: ~30 %.
         *          await new Promise(resolve => setImmediate(resolve));
         *      }
         *      handle(chunk);
         * }
         *
         * @template T
         * @param {ReadableStream<T>} stream
         * @returns {AsyncGenerator<T>}
         */
        static async * iterateReadableStream(stream) {
            const reader = stream.getReader();
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }
                yield value;
            }
        }


        /**
         * Browsers' MessagePort has no `unref`/`ref`,
         * but the realization for Node requires to use them so let's just use `globalThis.setImmediate`.
         */
        static setImmediate = globalThis.setImmediate ||
            /*#__PURE__*/ (function() {
                const {port1, port2} = new MessageChannel();
                const queue = [];

                port1.onmessage = function() {
                    const callback = queue.shift();
                    callback();
                    // if (!queue.length) {
                    //     port1.unref();
                    // }
                };
                // port1.unref();

                return function(callback) {
                    // port1.ref();
                    port2.postMessage(null);
                    queue.push(callback);
                };
            })();


        // https://developers.google.com/web/updates/2011/09/Workers-ArrayBuffer
        // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
        static structuredClone(object) {
            return new Promise(resolve => {
                const {port1, port2} = new MessageChannel();
                port1.onmessage = function(message) {
                    resolve(message.data);
                };
                port2.postMessage(object);
            });
        }

        // // the experimental version
        // static logger = {
        //     DEBUG: true,
        //     INFO: true,
        //     /**
        //      * @param {*} arguments
        //      */
        //     debug() {
        //         if (!Util.logger.DEBUG) {
        //             return;
        //         }
        //         // rollup says: "A static class field initializer may not contain arguments"
        //         [...arguments].forEach(el => {
        //             console.log(el);
        //         });
        //         console.log();
        //     },
        //     /**
        //      * @param {*} arguments
        //      */
        //     info() {
        //         if (!Util.logger.INFO) {
        //             return;
        //         }
        //         // rollup says: "A static class field initializer may not contain arguments"
        //         [...arguments].forEach(el => {
        //             console.log(el);
        //         });
        //     }
        // };
    }

    // import {default as CryptoJS} from "crypto-es";      // or
    // import CryptoJS from "./dependencies/crypto-es.js"; // or

    class Crypto {
        /**
         * Decrypt AES with `CryptoJS` (Upd: CryptoES)
         *
         * Modes: "CBC" (the default), "CFB", "CTR", "OFB", "ECB".
         *
         * Padding schemes: "Pkcs7" (the default), "ZeroPadding", "NoPadding", "Iso97971", "AnsiX923", "Iso10126".
         *
         * Default IV is zero filled ArrayBuffer.
         *
         * @param {Uint8Array} data
         * @param {Uint8Array} key
         * @param {Object} [config]
         * @param {Uint8Array} [config.iv]
         * @param {"CBC"|"CFB"|"CTR"|"OFB",|"ECB"} [config.mode="CBC"]
         * @param {"Pkcs7"|"ZeroPadding"|"NoPadding"|"Iso97971"|"AnsiX923"|"Iso10126"} [config.padding="Pkcs7"]
         * @returns {Uint8Array}
         */
        static decryptAES(data, key, {iv, mode, padding} = {}) {

            /** Default parameters initialization */
            iv = iv || new Uint8Array(key.length);
            mode = mode || "CBC";
            padding = padding || "Pkcs7";


            /**
             * THE BEST
             *
             * Faster 5-9 times than old one. (x5 for zeros, x9+ for random values)
             *
             * Endianness independent.
             * @param {Uint8Array} u8Array
             */
            const _arrayBufferToWordArray4 = function(u8Array) {
                const length = Math.trunc(u8Array.length / 4) + (u8Array.length % 4 ? 1 : 0);
                const view = new DataView(u8Array.buffer, u8Array.byteOffset, u8Array.byteLength);
                const words = new Array(length);
                for (let i = 0; i < length; i++) {
                    words[i] = view.getInt32(i * 4, false);
                }
                return CryptoJS.lib.WordArray.create(words, u8Array.byteLength);
            };

            const _data = _arrayBufferToWordArray4(data);
            const _key = _arrayBufferToWordArray4(key);
            const _iv = _arrayBufferToWordArray4(iv);
            const plaintextWA = CryptoJS.AES.decrypt( /* (CipherParamsData, WordArray, IBlockCipherCfg) (for CryptoJS) */
                {
                    ciphertext: _data
                },
                _key,
                {
                    iv: _iv,
                    mode: CryptoJS.mode[mode],
                    padding: CryptoJS.pad[padding]
                }
            );
            // THE BEST: 4 times faster
            const _wordArrayToArrayBuffer2 = function(wordArray) {
                const {words, sigBytes} = wordArray;
                const arrayBuffer = new ArrayBuffer(words.length * 4);
                const view = new DataView(arrayBuffer);
                for (let i = 0; i < words.length; i++) {
                    view.setInt32(i * 4, words[i], false);
                }
                return new Uint8Array(arrayBuffer, 0, sigBytes);
            };

            return _wordArrayToArrayBuffer2(plaintextWA);
        }
    }

    /**
     * The class contains Mega specific static util methods.
     */
    class MegaUtil {

        /**
         * @param {string} attributesEncoded
         * @param {Uint8Array} nodeKey
         * @returns {{name: string, serializedFingerprint: string}}
         */
        static parseEncodedNodeAttributes(attributesEncoded, nodeKey) {
            const attributesEncrypted   = MegaUtil.megaBase64ToArrayBuffer(attributesEncoded);
            const attributesArrayBuffer = Crypto.decryptAES(attributesEncrypted, nodeKey, {padding: "ZeroPadding"});
            const attributesPlane       = Util.arrayBufferToUtf8String(attributesArrayBuffer);

            const trimmedAttributesPlaneString = attributesPlane.substring("MEGA".length);
            const {
                n: name,
                c: serializedFingerprint // Only for files (not folders)
            } = JSON.parse(trimmedAttributesPlaneString);

            return {name, serializedFingerprint};
        }

        /**
         * @param {string} serializedFingerprint
         * @returns {{modificationDate: number, fileChecksum: Uint8Array}}
         */
        static parseFingerprint(serializedFingerprint) {
            const fingerprintBytes = MegaUtil.megaBase64ToArrayBuffer(serializedFingerprint);

            const fileChecksum    = fingerprintBytes.subarray(0, 16); // 4 CRC32 of the file [unused]
            const timeBytesLength = fingerprintBytes[16];             // === 4, and 5 after 2106.02.07 (06:28:15 UTC on Sunday, 7 February 2106)
            const timeBytes       = fingerprintBytes.subarray(17, 17 + timeBytesLength); // in fact, after this no data is

            // I don't think that it is necessary, but let it be
            if (timeBytesLength > 5) {
                throw "Invalid value: timeBytesLength = " + timeBytesLength;
            }

            const modificationDate = Util.arrayBufferToLong(timeBytes);

            return {modificationDate, fileChecksum};
        }

        /**
         * {@link https://github.com/gpailler/MegaApiClient/blob/93552a027cf7502292088f0ab25f45eb29ebdc64/MegaApiClient/Cryptography/Crypto.cs#L63}
         * @param {Uint8Array} decryptedKey
         * @returns {{iv: Uint8Array, metaMac: Uint8Array, key: Uint8Array}}
         */
        static decryptionKeyToParts(decryptedKey) {
            const iv      = decryptedKey.subarray(16, 24);
            const metaMac = decryptedKey.subarray(24, 32);
            const key     = new Uint8Array(16);

            // 256 bits -> 128 bits
            for (let i = 0; i < 16; i++) {
                key[i] = decryptedKey[i] ^ decryptedKey[i + 16];
            }

            return {iv, metaMac, key};
        }

        /**
         * {@link https://github.com/gpailler/MegaApiClient/blob/93552a027cf7502292088f0ab25f45eb29ebdc64/MegaApiClient/Cryptography/Crypto.cs#L33}
         * @param {Uint8Array} encryptedKey a key that need to decrypt
         * @param {Uint8Array} key a key to decrypt with it
         * @returns {Uint8Array} decryptionKey
         */
        static decryptKey(encryptedKey, key) {
            const result = new Uint8Array(encryptedKey.length);

            for (let i = 0; i < encryptedKey.length; i += 16) {
                const block = encryptedKey.subarray(i, i + 16);
                const decryptedBlock = Crypto.decryptAES(block, key, {padding: "NoPadding"}); // "NoPadding" – for the case when the last byte is zero (do not trim it)
                result.set(decryptedBlock, i);
            }

            return result;
        }

        // ----------------------------------------------------------------

        /**
         * Transform Mega Base64 format to normal Base64
         *   "AWJuto8_fhleAI2WG0RvACtKkL_s9tAtvBXXDUp2bQk"
         *   ->
         *   "AWJuto8/fhleAI2WG0RvACtKkL/s9tAtvBXXDUp2bQk="
         * @param {string} megaBase64EncodedStr
         * @returns {string}
         */
        static megaBase64ToBase64(megaBase64EncodedStr) {
            /** @param {string} megaBase64EncodedStr
             *  @returns {number}
             *  @private  */
            function _getPaddingLengthForMegaBase64(megaBase64EncodedStr) {
                /**
                 * Base64 padding's length is "1", "2" or "0" because of the "block" size has at least "2" chars.
                 * So a string's length is multiple of "4".
                 * Check the tables:
                 *     https://en.wikipedia.org/wiki/Base64#Examples
                 */
                try {
                    
               
                const paddingLength = (4 - megaBase64EncodedStr.length % 4) % 4;
                if (paddingLength === 3) {
                    throw {name: "IllegalArgumentException", message: "Wrong Mega Base64 string"};
                }
                return paddingLength;
                } catch (error) {
                    return 100
                }
            }

            const paddingLength = _getPaddingLengthForMegaBase64(megaBase64EncodedStr);
            const result = megaBase64EncodedStr + "=".repeat(paddingLength);
            return result.replace(/-/g, "+")
                         .replace(/_/g, "/");
        }

        /**
         * @param {string} megaBase64
         * @returns {Uint8Array}
         */
        static megaBase64ToArrayBuffer(megaBase64) {
            const base64 = MegaUtil.megaBase64ToBase64(megaBase64);
            return Util.base64ToArrayBuffer(base64);
        }

        /**
         * @param {string} base64EncodedStr
         * @return {string}
         */
        static base64ToMegaBase64(base64EncodedStr) {
            return base64EncodedStr.replace(/=/g,  "")
                                   .replace(/\+/g, "-")
                                   .replace(/\//g, "_");
        }

        /**
         * @param {Uint8Array} arrayBuffer
         * @return {string}
         */
        static arrayBufferToMegaBase64(arrayBuffer) {
            const binaryString = Util.arrayBufferToBinaryString(arrayBuffer);
            const base64 = Util.binaryStringToBase64(binaryString);
            return MegaUtil.base64ToMegaBase64(base64);
        }

        /**
         * @param {string} megaBase64
         * @returns {string}
         */
        static megaBase64ToBinaryString(megaBase64) {
            const base64 = MegaUtil.megaBase64ToBase64(megaBase64);
            return Util.base64ToBinaryString(base64);
        }

        // ----------------------------------------------------------------

        /**
         * Format bytes to human readable format like it do Mega.nz
         * {@link https://github.com/meganz/webclient/blob/8e867f2a33766872890c462e2b51561228c056a0/js/functions.js#L298}
         *
         * (Yeah, I have rewrote this)
         * @see Util.bytesToSize
         * @param {number} bytes
         * @param {number} [decimals]
         * @returns {string}
         */
        static bytesToSize(bytes, decimals) {
            if (bytes === 0) {
                return "0 B";
            }
            const k = 1024;
            if (!decimals) {
                if (bytes > Math.pow(k, 3)) {        // GB
                    decimals = 2;
                } else if (bytes > Math.pow(k, 2)) { // MB
                    decimals = 1;
                }
            }
            const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return (bytes / Math.pow(k, i)).toFixed(decimals) + " " + sizes[i];
        }
    }

    class MegaApi {

        static encryptedName = false; // If true, return "████" names instead of `null`, when no key is provided.

        static apiGateway = "https://g.api.mega.co.nz/cs";
        static grouped = true;

        static errorRepeatCount = 5;
        static errorRepeatDelay = 5000;
        /**
         * @param {function} executable - an async function to repeat if it throws an exception
         * @param {number} count=5 - count of the repeats
         * @param {number} delay=5000 - ms to wait before repeating
         * @return {Promise<*>}
         */
        static repeatIfErrorAsync(executable, count = MegaApi.errorRepeatCount, delay = MegaApi.errorRepeatDelay) {
            return Util$1.repeatIfErrorAsync(executable, count, delay);
        }

        static ssl = 2; // Is there a difference between "1" and "2" [???]
        /**
         * Max parallel requests count that Mega allows for API access are `63` within ~4 seconds.
         * If you perform more than 63 connection within ~4 seconds:
         * Fetch error (reason: write EPROTO) will happen (not a big problem, the request will be repeated)
         *
         * Example values: (63, 4000);   (12, 650);   (2, 0);
         */
        static semaphore = new synchronization_js.Semaphore(16, 1000);

        /**
         * @extends {GroupedTasks<String, Object, Object>}
         * @private
         */
        static RequestApiGrouped = class extends GroupedTasks$1 {
            async handle(entriesHolder) {
                const url = entriesHolder.key;

                const entries = entriesHolder.pull();
                const payloads = [];
                for (const entry of entries) {
                    payloads.push(entry.getValue());
                }

                const responseArray = await MegaApi.requestApiSafe(url, payloads);
                //console.log("[grouped request]", responseArray);

                entries.forEach((entry, index) => {
                    entry.resolve(responseArray[index]);
                });
            }
        }
        /** @private */
        static requestApiGrouped = new MegaApi.RequestApiGrouped();

        /**
         * @param {*} payload
         * @param {*} [searchParams]
         * @param {boolean} [grouped]
         * @returns {Promise<*>} responseData
         */
        static async requestApi(payload, searchParams = {}, grouped = MegaApi.grouped) {
            const _url = new URL(MegaApi.apiGateway);
            Util$1.addSearchParamsToURL(_url, searchParams);
            const url = _url.toString();

            if (grouped) {
                return MegaApi.requestApiGrouped.getResult({
                        key: url,
                        value: payload
                    });
            }
            return (await MegaApi.requestApiSafe(url, [payload]))[0];
        }

        /**
         * Note: If you move `semaphore` inside `requestApi` or `repeatIfErrorAsync`, then in case an error
         * the repeating request will be added at the end of queue of `semaphore`
         * @param {string|URL} url
         * @param {Object[]} payloads
         * @return {Promise<*[]>}
         * @private
         */
        static async requestApiSafe(url, payloads) {
            await MegaApi.semaphore.acquire();
            try {
                const response = await MegaApi.repeatIfErrorAsync(_ => MegaApi.requestApiUnsafe(url, payloads));
                return MegaApi.apiErrorHandler(response); // todo Retry if -3 exception
            } finally { // if an exception happens more than `count` times, or the error code was returned
                MegaApi.semaphore.release();
            }
        }

        /**
         * Returns an array with one item (multiple request are not implemented), or an error code (number)
         *
         * An exception may be thrown by `fetch`, for example, if you perform to many connections
         * or `json()` when Mega returns an empty string (if the server returns code 500)
         *
         * @param {string|URL} url
         * @param {Object[]} payloads
         * @return {Promise<*[]>}
         * @private
         */
        static async requestApiUnsafe(url, payloads) {
            const response = await fetch(url, {
                method: "post",
                body: JSON.stringify(payloads),
                referrerPolicy: "strict-origin-when-cross-origin"
            });

            if (response.status === 500) {
                throw Error("ERR_ABORTED 500 (Server Too Busy)"); // to do not parse the empty string
            } else if (response.status !== 200) {
                console.error("[response.status]", response.status);
            }

            const text = await response.text();
            //console.log("[api-response-text]", text);
            return JSON.parse(text);
        }

        /** @private */
        static apiErrorHandler(response) {
            if (Array.isArray(response)) { //todo for file links it is _in an array_
                return response;
            } else {
                // todo v2 api error response
                // todo create separate method to handle all errors
                // https://mega.nz/doc
                if (response === -9) {
                    throw new Error("ERROR CODE: -9. NOT FOUND");
                } else if (response === -16) {
                    throw new Error("ERROR CODE: -16. USER IS BLOCKED");
                } else if (response === -3) {
                    throw new Error("ERROR CODE: -3. AGAIN");
                    //  A temporary congestion or server malfunction prevented your request from being processed.
                    //  No data was altered. Retry.
                    //  Retries must be spaced with exponential backoff. //todo
                } else {
                    throw new Error("ERROR CODE: " + response); // `response` is a number like this: `-9`
                }
            }
        }

        // ----------------------------------------------------------------

        /**
         * @param {FileAttribute} fileAttribute
         * @param {string} fileAttribute.id - file attribute ID
         * @param {number} fileAttribute.type - file attribute type
         * @return {Promise<string>}
         */
        static async requestFileAttributeDownloadUrl({id, type}) {
            console.log("Request download url...");
            const responseData = await MegaApi.requestApi({
                "a": "ufa",    // action (command): u [???] file attribute
                "fah": id,     // `h` means handler(hash, id)
                "ssl": MegaApi.ssl,
                "r": 1         // r [???] – It adds "." in response url (without this dot the url does not work)
            });

            //todo if [{"p":"https://gfs302n203.userstorage.mega.co.nz/.yWdyTeW","p0":"https://gfs270n873.userstorage.mega.co.nz/.Uy96JeV"}]
            return responseData["p"] + "/" + type;
        }


        // todo add semaphore, not more than 31 (included) connections for each url (of bunch)
        //  to test it, use `Thumbnail.getEncryptedBytes(..., false)` <- "false"
        //  in some kind it is implemented in `FileAttributeBytes.DlBytesRequests`
        /**
         * @param {string} url
         * @param {string|string[]} ids
         * @returns {Promise<Uint8Array>} responseBytes
         * @throws ETIMEDOUT, ECONNRESET
         */
        static async requestFileAttributeBytes(url, ids) {
            /** @type Uint8Array */
            let selectedIdsBinary;

            if (Array.isArray(ids)) {
                selectedIdsBinary = new Uint8Array(ids.length * 8);
                for (let i = 0; i < ids.length; i++) {
                    selectedIdsBinary.set(MegaUtil$1.megaBase64ToArrayBuffer(ids[i]), i * 8);
                }
            } else {
                selectedIdsBinary = MegaUtil$1.megaBase64ToArrayBuffer(ids);
            }

            /** Sometimes it can throw `connect ETIMEDOUT` or `read ECONNRESET` exception */
            const callback = async () => {
                console.log("Downloading content... ");
                const response = await fetch(url, {
                    method: "post",
                    body: selectedIdsBinary,
                    headers: {
                        // It's important for `node-fetch` (Node.js)
                        // But it is not needed in a browser
                        "connection": "keep-alive"
                    },
                    referrerPolicy: "strict-origin-when-cross-origin"
                });
                if (response.status !== 200) {
                    console.error("[response.status]", response.status);
                }
                return new Uint8Array(await response.arrayBuffer());
            };
            const responseBytes = await MegaApi.repeatIfErrorAsync(callback);
            console.log("[downloaded]", responseBytes.length, "bytes");
            return responseBytes;
        }

        // ----------------------------------------------------------------

        /**
         * @param {string} shareId
         * @returns {Promise<{size: number, nodeAttributesEncoded: string,
         *           downloadUrl: string, timeLeft: number, EFQ: number, MSD: number, fileAttributesStr?: string}>} nodeInfo
         */
        static async requestNodeInfo(shareId) {
            const responseData = await MegaApi.requestApi({
                "a": "g",        // Command type
                "p": shareId,    // Content ID
                "g": 1,          // The download link
                //"v": 2,        // Multiple links for big files
                "ssl": MegaApi.ssl  // HTTPS for the download link
            });
            //console.log("[responseData]", responseData);

            const prettyResponse = {
                size:                  responseData["s"],
                nodeAttributesEncoded: responseData["at"],  // Node attributes (name, hash (file fingerprint) -> mtime)

                // If "g" is specified:
                downloadUrl:           responseData["g"],
                timeLeft:              responseData["tl"],  // Time to wait of the reset of bandwidth quota.
                                                            // `0` seconds if quota is not exceeded
                                                            // (It looks it is the new parameter added
                                                            //                             at the beginning of March 2020)
                // Useless properties: [unused]
                EFQ:                   responseData["efq"], // `1` – Something about the Quota – Quota enforcement?  [???]
                MSD:                   responseData["msd"]  // `1` – "MegaSync download"                             [???]
            };

            if (responseData["fa"]) {
                // File attributes (a thumbnail, a preview, [a video meta info])
                // Only for an image or a video
                prettyResponse.fileAttributesStr = responseData["fa"];
            }

            return prettyResponse;
        }

        // The logic of nodes order that Mega returns looks like it is:
        // The first node is root node,
        // the next: root node children sorted by creationDate (folders have the same priority as files),
        // the next: nodes (also sorted by creationDate) of each folder,
        //              these folder iterates from last one to the first (like a stack works). And etc.
        //
        // So, a folder node is always located before the nodes that are inside it,       <-- [important]
        // all nodes with the same parent are listed one by one in creationDate order,
        // one level folders iterates in reverse order to `print` their children.
        static async requestFolderInfo(shareId) {
            const responseData = await MegaApi.requestApi({
                "a": "f",
                "r":  1, // Recursive (include sub folders/files) // if not set only root node and 1th lvl file/folder nodes
                "c":  1, // [???][useless]
                "ca": 1, // [???][useless]
            }, {
                "n": shareId
            });
            //console.log("[responseData]", responseData);

            const {
                f: rawNodes, // array of file and folder nodes
                sn, // [???][unused] // "McPlUF51ioE" [random]
                noc // [???][unused] // "1"
            } = responseData;


            function _getShareRootNodeId(rawNodes) {
                // Every node has a prefix in its `k` value – `shareRootNodeId:decryptionKey`
                const firstNode = rawNodes[0];
                const id = firstNode["k"].match(/^[^:]+/)[0];

                // In fact the first node is the share root
                // Recheck:
                if (id !== firstNode["h"]) {
                    console.warn("ShareRootNodeId does not equal to id of the first node.");
                }

                return id;
            }

            const shareRootNodeId = _getShareRootNodeId(rawNodes);
            //console.log("[shareRootNodeId]", shareRootNodeId);


            function _prettifyType(type) {
                switch (type) {
                    case  0: return "file";
                    case  1: return "folder";
                    default: return type;
                }
            }

            function _parseKeyFromNode(node) {
                const decryptionKeyStr = node["k"];
                // a missing key (an empty string), it's very rarely, but it can be
                if (decryptionKeyStr === "") {
                    console.log("A missed key!", node);
                    return null;
                }
                return decryptionKeyStr.match(/(?<=:)[\w-_]+/)[0];
            }

            function _prettifyNodes(rawNodes) {
                return rawNodes.map(node => {
                    const prettyNode = {
                        id: node["h"],
                        parentId: node["p"],
                        ownerId: node["u"],
                        type: _prettifyType(node["t"]),
                        attributes: node["a"],
                        decryptionKeyStr: _parseKeyFromNode(node), // from node["k"]
                        creationDate: node["ts"], // (timestamp)
                    };
                    if (prettyNode.type === "file") {
                        prettyNode.size = node["s"];
                        if (node["fa"]) { // only for images and videos
                            prettyNode.fileAttributesStr = node["fa"];
                        }
                    }
                    return prettyNode;
                });
            }

            return {nodes: _prettifyNodes(rawNodes), rootId: shareRootNodeId};
        }

    }

    /**
     * @typedef {Function} Resolve
     */

    /** @template K, V, R */
    class SimpleEntry {
        /** @type {function(Resolve): void} */
        resolve;

        /**
         * @param {K} key - group criterion
         * @param {V} value
         * @param {Resolve} resolve
         * @param {Function} reject
         */
        constructor(key, value, resolve, reject) {
            this.key     = key;
            this.value   = value;
            this.resolve = resolve;
            this.reject  = reject;
        }

        /** @return {K} */
        getKey() {
            return this.key;
        }

        /** @return {V} */
        getValue() {
            return this.value;
        }

        /**
         * Override if you implement `getResult()`
         * @default
         * @return {boolean}
         */
        needHandle() {
            return true;
        }

        /**
         * @abstract
         * @return {R}
         */
        getResult() {
            throw "SimpleEntry.getResult() method does not implemented";
        }
    }

    /** @template K, V, R */
    class EntriesHolder {
        /** @type {K} */
        key;
        /** @type {SimpleEntry<K, V, R>} */
        first;

        /**
         * @param {K} entryKey
         * @param {SimpleEntry<K, V, R>} firstEntry
         * @param {GroupedTasks<K, V, R>} groupedTasks
         */
        constructor(entryKey, firstEntry, groupedTasks) {
            this.key = entryKey;
            this.first = firstEntry;
            this.groupedTasks = groupedTasks;
        }

        /** @return {SimpleEntry<K, V, R>[]} */
        pull() {
            return this.groupedTasks.pullEntries(this.key);
        }

        /**
         * If passed `0` - no splitting
         * @param count
         * @return {Generator<SimpleEntry<K, V, R>[]>}
         */
        parts(count) {
            return this.groupedTasks.pullParts(this.key, count);
        }
    }

    /**
     * @template K, V, R
     * @abstract
     */
    class GroupedTasks {

        /**
         * @param {SimpleEntry<K, V, R>} entryClass
         * @param {Function} delayStrategy
         */
        constructor({entryClass, delayStrategy} = {}) {
            this.entryClass = entryClass || GroupedTasks.SimpleEntry;
            this.delayStrategy = delayStrategy || GroupedTasks.execute.afterDelayWithMicroTask;
        }

        /**
         * @type {Class<SimpleEntry<K, V, R>>}
         */
        static SimpleEntry = SimpleEntry;

        /**
         * @type Map<K, SimpleEntry<K, V, R>[]>
         * @private
         */
        queue = new Map();

        /**
         * @param {Object} init
         * @param {K?} init.key
         * @param {V?} init.value
         * @return {Promise<R>}
         */
        getResult({key, value}) {
            return new Promise((resolve, reject) => {
                const entry = new this.entryClass(key, value, resolve, reject);
                if (entry.needHandle()) {
                    this.enqueue(entry);
                } else {
                    resolve(entry.getResult());
                }
            });
        }

        /**
         * @param {SimpleEntry<K, V, R>} entry
         * @private
         */
        enqueue(entry) {
            const entryKey = entry.getKey();
            if (!this.queue.has(entryKey)) {
                this.queue.set(entryKey, []);
                this.delayStrategy(() => {
                    this.handle(new EntriesHolder(entryKey, entry, this))
                        .catch(entry.reject);
                });
            }
            this.queue.get(entryKey).push(entry);
        }

        /**
         * @param {K} key
         * @return {SimpleEntry<K, V, R>[]}
         */
        pullEntries(key) {
            const array = this.queue.get(key);
            this.queue.delete(key);
            return array;
        }

        /**
         * @param {K} key
         * @param {Number} count
         * @return {Generator<SimpleEntry<K, V, R>[]>}
         */
        *pullParts(key, count) {
            const array = this.pullEntries(key);

            if (!count) {
                yield array;
            } else {
                let pos = 0;
                while (pos < array.length) {
                    yield array.slice(pos, pos + count);
                    pos += count;
                }
            }
        }

        /**
         * @abstract
         * @param {EntriesHolder<K, V, R>} entriesHolder
         * @return {Promise<void>}
         */
        async handle(entriesHolder) {}

        /** Contains methods to delay the execution of the passed callback */
        static execute = class {
            static now(executable) {
                executable();
            }
            static afterDelayWithMicroTask(executable){ // Delay execution with micro task queue
                Promise.resolve().then(executable);
            }
            static afterDelayWithEventLoop(executable){
                setImmediate ? setImmediate(executable) : setTimeout(executable, 0);
            }
            static afterDelay(executable, ms = 0){
                setTimeout(executable, ms);
            }
        }
    }

    class Semaphore {
        /**
         * By default works like a mutex
         * @param {number} limit - the max count of parallel executions
         * @param {number} time  - the time within which does not allowed to perform more than `limit` operations. (ms)
         */
        constructor(limit = 1, time = 0) {
            this.limit = limit;
            this.delay = time;
        }

        /** @type {number} - the count of active parallel executions */
        active = 0;
        /** @type {(function: void)[]} - resolve functions of enqueued executions */
        pending = [];
        /** @type {number[]} - finish times of completed executions (it's used when there is no enqueued executions) */
        completeTimes = [];

        /** @return {Promise<void>} */
        async acquire() {
            if (this.isDisabled) {
                return;
            }

            const completed = this.completeTimes.length;
            if (completed > 0 && completed === this.limit - this.active) {
                const time = this.delay - (performance.now() - this.completeTimes.shift());
                console.log("completed: " + completed + ", active: " + this.active + ", wait: " + time);
                await Util.sleep(time);
            }

            if (this.active < this.limit) {
                this.active++;
                return;
            }

            return new Promise(resolve => {
                this.pending.push(resolve);
            });
        }

        /**
         * Recommendation: release in a finally block.
         */
        release() {
            // Just do not return a Promise
            this._release().then(/*ignore promise*/);
        }

        /** @private */
        async _release() {
            if (this.isDisabled) {
                return;
            }

            if (this.active > 0) {
                this.active--;

                if (this.pending.length > 0) {
                    const resolve = this.pending.shift();
                    this.active++;
                    await Util.sleep(this.delay);
                    resolve();
                } else if (this.delay > 0) {
                    this.completeTimes.push(performance.now());
                }
            } else {
                console.warn("[Semaphore] over released"); // a possible error is in a code
            }
        }

        /**
         * Note (It's important, in other case the semaphore will not work):
         * When you want to limit the parallel execution count of an async function
         * use `return` statement in the "executable" callback,
         * or use `await` statement in the "executable" callback if you do not need the result.
         *
         * @example
         * const semaphore = new Semaphore(4);
         * for (const value of values) {
         *      semaphore.sync(() => {
         *          return handle(value);
         *      }).then(console.log); // result of `handle`
         * }
         * @example
         * const semaphore = new Semaphore(4);
         * for (const value of values) {
         *      semaphore.sync(async () => {
         *          await handle(value);
         *      }).then(console.log); // `undefined`
         * }
         *
         * @param {function(): Promise<*>} executable
         * @return {Promise<*>}
         */
        async sync(executable) {
            try {
                await this.acquire();
                return await executable();
            } finally {
                this.release();
            }
        }

        /**
         * Release all waiters without any delay
         */
        releaseAll() {
            while (this.pending.length) {
                const resolve = this.pending.shift();
                resolve();
            }
            this.active = 0;
            this.completeTimes = [];
        }

        _limit;
        _delay;

        set limit(value) {
            if (value < 1) {
                this._limit = 1;
            } else {
                this._limit = value;
            }
        }

        get limit() {
            return this._limit;
        }

        set delay(value) {
            if (value < 0) {
                this._delay = 0;
            } else {
                this._delay = value;
            }
        }

        get delay() {
            return this._delay;
        }

        isDisabled = false;

        disable(releaseAll = true) {
            if (releaseAll) {
                this.releaseAll();
            }
            this.isDisabled = true;
        }

        enable() {
            this.isDisabled = false;
        }

        /**
         * Static factory method, works as constructor.
         * Returns the disabled semaphore.
         * Pass it to a code that expect a semaphore, but you do not need it.
         */
        static disabled(max = 1, delay = 0) {
            const semaphore = new Semaphore(max, delay);
            semaphore.disable();
            return semaphore;
        }
    }

    class CountDownLatch {
        _count;
        _promise;
        _resolve;

        /** @param {number} count */
        constructor(count = 0) {
            this._count = count;
            if (count > 0) {
                this._promise = new Promise(resolve => {
                    this._resolve = resolve;
                });
            } else {
                this._promise = Promise.resolve();
            }
        }

        countDown() {
            if (this._count > 0) {
                this._count--;
                if (this._count === 0) {
                    this._resolve();
                }
            }
        }

        /** @return {Promise<void>} */
        wait() {
            return this._promise;
        }

        /** @return {boolean} */
        get released() {
            return this._count > 0;
        }

        release() {
            this._count = 0;
            this._resolve();
        }
    }

    class CountUpAndDownLatch extends CountDownLatch {
        countUp() {
            if (this._count === 0) {
                this._promise = new Promise(resolve => {
                    this._resolve = resolve;
                });
            }
            this._count++;
        }
    }

    var synchronization = {Semaphore, CountDownLatch, CountUpAndDownLatch};

    var synchronization$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        Semaphore: Semaphore,
        CountDownLatch: CountDownLatch,
        CountUpAndDownLatch: CountUpAndDownLatch,
        'default': synchronization
    });

    /**
     * The interface of a media file node
     * @typedef {{fileAttributesStr: string, key?: Uint8Array}} IMediaNodeSimple
     */

    /**
     * @typedef IMediaGettersMixin
     * @property {FileAttribute} thumbnail
     * @property {FileAttribute} preview
     * @property {function(): Promise<Uint8Array>} getThumbnail
     * @property {function(): Promise<Uint8Array>} getPreview
     */

    /**
     * @typedef {IMediaNodeSimple & IMediaGettersMixin} IMediaNode
     */

    /**
     *
     */
    class FileAttribute {
        /** @type {string} */
        id;
        /** @type {number} */
        type;
        /** @type {Bunch} */
        bunch;

        /**
         * @param {string} id - `id`, or `handler` as Mega names it
         * @param {number|*} type - 0 – thumbnail, 1 - preview, 8 - ..., 9 - ...
         * @param {number|*} bunch - Attributes with the same bunch number can be requested within one API request
         */
        constructor(id, type, bunch) {
            this.id = id;
            this.type = Number(type);
            this.bunch = Bunch.of(Number(bunch));
        }

        /**
         * @param {boolean} cached=true
         * @return {Promise<string>}
         */
        getDownloadUrl(cached = true) {
            if (!Types.hasBytes(this)){
                return null;
            }
            return this.bunch.getDownloadUrl(this, cached);
        }

        toString() {
            return this.bunch + ":" + this.type + "*" + this.id;
        }
    }

    class Bunch {
        /** @type {Number} */
        id;

        downloadUrl = null;

        /**
         * The holder of the instances of this class.
         * @private
         * @type {Map<number, Bunch>}
         */
        static values = new Map();

        /**
         * Use `of` method to get an instance.
         * @private
         * @param {number} bunch
         */
        constructor(bunch) {
            this.id = Number(bunch);
        }

        toString() {
            return this.id.toString();
        }

        /**
         * @param {number} bunch
         * @return {Bunch}
         */
        static of(bunch) {
            if (Bunch.values.has(bunch)) {
                return Bunch.values.get(bunch);
            }
            const _bunch = new Bunch(bunch);
            Bunch.values.set(bunch, _bunch);
            return _bunch;
        }

        /**
         * @param {FileAttribute} fileAttribute
         * @param {boolean} cached=true
         * @return {Promise<string>}
         */
        async getDownloadUrl(fileAttribute, cached = true) {
            if (cached && this.hasDownloadUrl) {
                return this.downloadUrl;
            }
            const url = await MegaApi.requestFileAttributeDownloadUrl(fileAttribute);
            //todo urls
            this.downloadUrl = url;
            return url;
        }
        get hasDownloadUrl() {
            return Boolean(this.downloadUrl);
        }
        get downloadUrl() {
            return this.downloadUrl;
        }
    }

    class Types {
        static thumbnail = 0;
        static preview   = 1;

        /**
         * @param {FileAttribute} fileAttribute
         * @return {boolean}
         */
        static hasBytes(fileAttribute) {
            return fileAttribute.type === Types.preview || fileAttribute.type === Types.thumbnail;
        }
    }

    class FileAttributeBytes {
        static cached = true;
        static grouped = true

        /** @type {number} */ //todo use Types?
        type;

        get type() {
            return this.type;
        }

        constructor(type) {
            this.type = type;
        }

        /**
         * @extends {GroupedTasks<Number, FileAttribute, String>}
         */
        static DlUrlRequests = class extends GroupedTasks {
            async handle(entriesHolder) {
                const fileAttribute = entriesHolder.first.getValue();
                const result = await fileAttribute.getDownloadUrl();

                for (const entry of entriesHolder.pull()) {
                    entry.resolve(result);
                }
            }

            /** @type {Class<!GroupedTasks.SimpleEntry<Number, FileAttribute, String>>} */
            static RequestDlUrlEntry = class extends GroupedTasks.SimpleEntry {
                /** @return {boolean} */
                needHandle() {
                    return !this.getValue().bunch.hasDownloadUrl;
                }
                /** @return {String} */
                getResult() {
                    return this.getValue().bunch.downloadUrl;
                }
                /** @return {number} */
                getKey() {
                    return this.getValue().bunch.id;
                }
            }
        }
        static dlUrlRequests = new FileAttributeBytes.DlUrlRequests({
            entryClass: FileAttributeBytes.DlUrlRequests.RequestDlUrlEntry,
            delayStrategy: GroupedTasks.execute.now
        });

        /**
         * @param options
         * @param {FileAttribute} [options.fileAttribute]
         * @param {IMediaNode} [options.node]
         * @param {boolean} cached=true - do not request the new URL, if already there is one, experimental use only
         * @return {Promise<string>} downloadUrl
         */
        getDownloadUrl({fileAttribute, node}, cached = FileAttributeBytes.cached) {
            const _fileAttribute = fileAttribute || FileAttributes.of(node).byType(this.type);
            if (cached) {
                return FileAttributeBytes.dlUrlRequests.getResult({
                        value: _fileAttribute
                    });
            }
            return _fileAttribute.getDownloadUrl(false);
        }

        /**
         * Split a grouped request (of file attribute bytes) to grouped requests of 16 requests in each.
         * Up to 16 parallel downloading for a chunk.
         * @extends {GroupedTasks<String, String, Uint8Array>}
         */
        static DlBytesRequests = class extends GroupedTasks {
            async handle(entriesHolder) {
                const downloadUrl = entriesHolder.key;

                const semaphore = new Semaphore(16); // do not use more than 31
                for (const entries of entriesHolder.parts(16)) { // use `0` to disable splitting
                    semaphore.sync(() => {
                        return this.handlePart(downloadUrl, entries);
                    }).then(/*ignore promise*/);
                }
            }

            /** @private */
            async handlePart(downloadUrl, entries) {
                /**
                 * Maps fileAttributeId to resolves
                 * (different nodes may have the same file attribute)
                 * @type {Map<string, Resolve[]>}
                 */
                const map = new Map();

                for (const entry of entries) {
                    const fileAttributeId = entry.getValue();
                    if (!map.has(fileAttributeId)) {
                        map.set(fileAttributeId, []);
                    }
                    map.get(fileAttributeId).push(entry.resolve);
                }

                const fileAttrIDs = [...map.keys()];
                const generator = FileAttributeBytes.fileAttributeBytes(downloadUrl, fileAttrIDs);
                for await (const {id, dataBytes} of generator) {
                    const resolvers = map.get(id);
                    for (const resolve of resolvers) {
                        resolve(dataBytes);
                    }
                }
            }
        }
        static dlBytesRequests = new FileAttributeBytes.DlBytesRequests();

        /**
         * @param options
         * @param {FileAttribute} [options.fileAttribute]
         * @param {string} [options.downloadUrl]
         * @param {IMediaNode} [options.node]
         * @param {boolean} grouped=true - with `false` it may work a bit faster, but extremely increases
         * the connection count – one per each file attribute, currently there is no limitation of connection count
         * in the code (a semaphore), but Mega handles 136 connections at one moment normally
         * @return {Promise<Uint8Array>} encryptedBytes
         */
        async getEncryptedBytes({fileAttribute, downloadUrl, node}, grouped = FileAttributeBytes.grouped) {
            const _fileAttribute = fileAttribute || FileAttributes.of(node).byType(this.type);
            const _downloadUrl = downloadUrl || await this.getDownloadUrl({fileAttribute: _fileAttribute});

            if (grouped) {
                return FileAttributeBytes.dlBytesRequests.getResult({
                    key: _downloadUrl,
                    value: _fileAttribute.id
                });
            }

            const responseBytes = await MegaApi.requestFileAttributeBytes(_downloadUrl, _fileAttribute.id);
            return FileAttributeBytes.parseBytes(responseBytes).dataBytes;
        }

        /**
         * @param {string} downloadUrl
         * @param {string[]} fileAttrIDs
         * @return {AsyncGenerator<{dataBytes: Uint8Array, id: string}>}
         */
        static async *fileAttributeBytes(downloadUrl, fileAttrIDs) {
            const responseBytes = await MegaApi.requestFileAttributeBytes(downloadUrl, fileAttrIDs);

            for (let i = 0, offset = 0; i < fileAttrIDs.length; i++) {
                const {id, dataBytes} = FileAttributeBytes.parseBytes(responseBytes, offset);
                yield {id, dataBytes};
                offset += 12 + dataBytes.length;
            }
        }

        /** @private */
        static parseBytes(bytes, offset = 0) {
            const idBytes     = bytes.subarray(offset,      offset +  8);
            const lengthBytes = bytes.subarray(offset + 8,  offset + 12);
            const length      = Util.arrayBufferToLong(lengthBytes);
            const dataBytes   = bytes.subarray(offset + 12, offset + 12 + length);
            const id          = MegaUtil.arrayBufferToMegaBase64(idBytes);
            return {id, dataBytes};
        }

        /**
         * @param options
         * @param {FileAttributes} [options.fileAttributes]
         * @param {Uint8Array} [options.encryptedBytes]
         * @param {IMediaNode} [options.node]
         * @param {string} [options.downloadUrl]
         * @return {Promise<Uint8Array>}
         */
        async getBytes({fileAttributes, encryptedBytes, node, downloadUrl}) {
            const _fileAttributes = fileAttributes || FileAttributes.of(node);
            const fileAttribute = _fileAttributes.byType(this.type);
            const _encryptedBytes = encryptedBytes || await this.getEncryptedBytes({fileAttribute, downloadUrl, node});

            if (!_fileAttributes.nodeKey) {
                if (FileAttributes.strictMode) {
                    throw "No key specified for the file attribute decryption.";
                } else {
                    console.log("No key specified for the file attribute decryption. Skipping the decryption.");
                    return _encryptedBytes;
                }
            }
            console.log("Decryption of a file attribute...");
            return Crypto.decryptAES(_encryptedBytes, _fileAttributes.nodeKey, {padding: "ZeroPadding"});
        }
    }

    class FileAttributes {

        /**
         * If `false` (default) returns not decrypted file attribute if no node key specified.
         * If `true` `FileAttributes.getBytes` will throw the exception.
         *
         * @type {boolean}
         */
        static strictMode = false;

        /** @type {FileAttribute[]} */
        fileAttributes;
        /** @type {Uint8Array} */
        nodeKey;

        constructor(node) {
            const fileAttributes = [];

            const chunks = node.fileAttributesStr.split("\/");
            chunks.forEach(chunk => {
                const groups = chunk.match(/(?<bunch>\d+):(?<type>\d+)\*(?<id>.+)/).groups;
                const {id, type, bunch} = groups;
                fileAttributes.push(new FileAttribute(id, type, bunch));
            });

            this.fileAttributes = fileAttributes;
            this.nodeKey = node.key || null;
        }

        /** Example output: "924:1*sqbpWSbonCU/925:0*lH0B2ump-G8" */
        toString() {
            return this.fileAttributes.join("/");
        }

        /**
         * Get file attribute by type (0, 1, 8, or 9)
         * @param {number} type
         * @return {FileAttribute}
         */
        byType(type) {
            return this.fileAttributes.find(att => att.type === type);
        }

        // ========

        /** @type {Map<String, FileAttributes>} */
        static values = new Map();

        /**
         * @param {IMediaNode} node
         */
        static add(node) {
            if (!FileAttributes.values.get(node.fileAttributesStr)) {
                FileAttributes.values.set(node.fileAttributesStr, new FileAttributes(node));
            }
        }

        /**
         * @param {IMediaNode} node
         * @return {FileAttributes}
         */
        static get(node) {
            return FileAttributes.values.get(node.fileAttributesStr);
        }

        /**
         * @param {IMediaNode} node
         * @return {FileAttributes}
         */
        static of(node) {
            FileAttributes.add(node);
            return FileAttributes.get(node);
        }

        // ========

        /** Like a static class, but with polymorphism */
        static Thumbnail = new FileAttributeBytes(Types.thumbnail);
        static Preview   = new FileAttributeBytes(Types.preview);

        /**
         * @param {IMediaNode} node
         * @return {Promise<Uint8Array>}
         */
        static getThumbnail(node) {
            return FileAttributes.getAttribute(node, FileAttributes.Thumbnail);
        }
        /**
         * @param {IMediaNode} node
         * @return {Promise<Uint8Array>}
         */
        static getPreview(node) {
            return FileAttributes.getAttribute(node, FileAttributes.Preview);
        }

        /**
         * NB: can be not only JPG (FF D8 FF (E0)), but PNG (89 50 4E 47 0D 0A 1A 0A) too, for example.
         * https://en.wikipedia.org/wiki/List_of_file_signatures
         *
         * @param {IMediaNode} node
         * @param {FileAttributeBytes} typeClass
         * @return {Promise<Uint8Array>}
         */
        static getAttribute(node, typeClass) {
            return typeClass.getBytes({node});
        }

    }

    /**
     * This class represents the share,
     * the information that is needed to get the access to a shared content – a folder, or a file.
     *
     * Usually you have the URL, that contains that data.
     * `Share.fromUrl(url)` parses the URL and returns the instance of this class.
     */
    class Share {
        /** @type {string} */
        id;
        /** @type {string} */
        decryptionKeyStr;
        /** @type {boolean} */
        isFolder;
        /** @type {string} */
        selectedFolderId;
        /** @type {string} */
        selectedFileId;

        /**
         * @private
         * @param {{
         *    id: string,
         *    decryptionKeyStr?: string,
         *    isFolder?: boolean,
         *    selectedFolderId?: string,
         *    selectedFileId?: string
         *  }} shareParts
         */
        constructor(shareParts) {
            Object.assign(this, shareParts);
        }

        /** @return {string} */
        toString() {
            return "" +
                "[id]               " + this.id               + "\n" +
                "[decryptionKeyStr] " + this.decryptionKeyStr + "\n" +
                "[isFolder]         " + this.isFolder         + "\n" +
                "[selectedFolderId] " + this.selectedFolderId + "\n" +
                "[selectedFileId]   " + this.selectedFileId   + "\n" +
                "[url]              " + this.getUrl()         + "\n" +
                "[url-legacy]       " + this.getUrl(true);
        }

        /**
         * @param {string|URL} url - URL
         * @return {boolean}
         */
        static isFolder(url) {
            return Share.fromUrl(url).isFolder;
        }

        /** @return {string} */
        get selectedId() {
            return this.selectedFileId || this.selectedFolderId || null;
        }

        //todo? create a singleton/caching for at least one last url? to do not parse several times the same url.
        /**
         * @see URLS
         * @param {string|URL} url - URL
         * @returns {Share}
         */
        static fromUrl(url) {
            const _url = url.toString(); // if passed a URL object
            const isLegacyURL = /#F!|#!/;
            let regExp;

            if (_url.match(isLegacyURL)) {
                regExp = /(?<type>(?<isFolder>#F!)|(?<isFile>#!))(?<id>[\w-_]+)(?<keyPrefix>!(?=[\w-_]{22,43})|!(?=[!?])|!(?![\w-_]{8}))?(?<key>(?<=!)[\w-_]{22,43})?(?<selected>((?<selectedFilePrefix>\?)|(?<selectedFolderPrefix>!?))((?<file>(?<=\?)[\w-_]+)|(?<folder>(?<=!)[\w-_]+)))?/;
            } else {
                regExp = /(?<type>(?<isFolder>folder\/)|(?<isFile>file\/))(?<id>[\w-_]+)(?<keyPrefix>#)?(?<key>(?<=#)[\w-_]{22,43})?(?<selected>((?<selectedFilePrefix>\/file\/)|(?<selectedFolderPrefix>\/folder\/))((?<file>(?<=\/file\/)[\w-_]+)|(?<folder>(?<=\/folder\/)[\w-_]+)))?/;
            }

            const match = _url.match(regExp);
            if (!match) {
                throw `Unsupported URL ("${_url}")`;
            }
            const {groups} = match;

            const isFolder = Boolean(groups.isFolder);
            /** Content ID */
            const id = groups.id;
            /** Decryption key encoded with Mega's base64 */
            const decryptionKeyStr = groups.key    || "";
            const selectedFolderId = groups.folder || "";
            const selectedFileId   = groups.file   || "";

            return new Share({id, decryptionKeyStr, isFolder, selectedFolderId, selectedFileId});
        }

        /**
         * @param shareParts
         * @param {string}   shareParts.id
         * @param {string}  [shareParts.decryptionKeyStr=""]
         * @param {boolean} [shareParts.isFolder=false]
         * @param {string}  [shareParts.selectedFolderId=""]
         * @param {string}  [shareParts.selectedFileId=""]
         * @return {Share}
         */
        static fromParts({id, decryptionKeyStr = "", isFolder = false, selectedFolderId = "", selectedFileId = ""}) {
            return new Share({id, decryptionKeyStr, isFolder, selectedFolderId, selectedFileId});
        }

        /**
         * Returns the url string for a share.
         * I prefer to use the key separator when there is no key, but there is a selected node.
         * Note: `Share.fromUrl(url).getUrl()` may not be equal to `url` (even for the same format)
         *
         * @see URLS
         * @param {boolean} oldFormat
         * @returns {string}
         */
        getUrl(oldFormat = false) {
            let result;
            const prefixes = {
                folder:    oldFormat ? "#F" : "folder",
                file:      oldFormat ? "#"  : "file",
                id:        oldFormat ? "!"  : "/",
                key:       oldFormat ? "!"  : "#",
                selFile:   oldFormat ? "?"  : "/file/",
                selFolder: oldFormat ? "!"  : "/folder/",
            };

            let selected = "";
            if (this.selectedFileId) {
                selected = prefixes.selFile + this.selectedFileId;
            } else if (this.selectedFolderId) {
                selected = prefixes.selFolder + this.selectedFolderId;
            }

            result = "https://mega.nz/" +
                (this.isFolder ? prefixes.folder : prefixes.file) +
                prefixes.id + this.id +
                (this.decryptionKeyStr ? prefixes.key + this.decryptionKeyStr : "") +
                (selected && !this.decryptionKeyStr ? prefixes.key + selected : selected);

            return result;
        }
    }

    //todo the most basic class with [Symbol.toStringTag]: "MegaNode"

    class BasicFolderShareNode {
        [Symbol.toStringTag] = "BasicFolderShareNode";
        constructor(node, masterKey) {
            this.id           = node.id;
            this.parentId     = node.parentId;
            this.parent       = node.parent || null;
            this.ownerId      = node.ownerId;
            this.creationDate = node.creationDate;

            if (masterKey && node.decryptionKeyStr) {
                const decryptionKeyEncrypted = MegaUtil.megaBase64ToArrayBuffer(node.decryptionKeyStr);
                this._decryptionKey = MegaUtil.decryptKey(decryptionKeyEncrypted, masterKey);
            } else {
                this._decryptionKey = null;
            }
        }
        type;
        id;
        parentId;
        parent;
        ownerId;
        creationDate;
        _decryptionKey;

        get key() {
            return this._decryptionKey;
        };
        name; // [requires key]

        /**
         * Returns the array of parents names from the root node
         * @return {string[]}
         */
        get path() {
            if (this.parent) {
                return [...this.parent.path, this.parent.name];
            }
            return [];
        }

        /** @return {RootFolderNode} */
        get root() {
            return this.parent.type === "rootFolder" ? this.parent : this.parent.root;
        }
    }

    class FileNode extends BasicFolderShareNode {
        [Symbol.toStringTag] = "FileNode";
        constructor(node, masterKey) {
            super(node, masterKey);
            this.type = "file";
            this.size = node.size;

            if (masterKey && node.decryptionKeyStr) {
                const {
                    name,
                    serializedFingerprint
                } = MegaUtil.parseEncodedNodeAttributes(node.attributes, this.key);
                this.name = name;

                const {
                    modificationDate,
                    fileChecksum      // [unused][???]
                } = MegaUtil.parseFingerprint(serializedFingerprint);
                this.modificationDate = modificationDate;
            } else {
                this.modificationDate = null;
                this.name = getEncryptedName(node.attributes, true);
            }
        }
        size;

        _keyParts;
        get key() {
            if (!this._keyParts) {
                if (super.key) {
                    this._keyParts = MegaUtil.decryptionKeyToParts(super.key);
                } else {
                    this._keyParts = {iv: null, metaMac: null, key: null};
                }
            }
            return this._keyParts.key;
        };
        modificationDate;   // [requires key]
        get mtime() {       // An alias
            return this.modificationDate;
        }
        get modificationDateFormatted() {
            return Util.secondsToFormattedString(this.modificationDate);
        }

        get downloadUrl() { // not implemented
            return null;
        }
    }

    /**
     * @implements IMediaNodeSimple
     * @mixes IMediaGettersMixin
     */
    // todo: add file attribute support for 8, 9 (9 may not exists)
    class MediaFileNode extends FileNode {
        [Symbol.toStringTag] = "MediaFileNode";
        constructor(node, masterKey) {
            super(node, masterKey);
            this.type = "mediaFile";
            this.fileAttributesStr = node.fileAttributesStr;
        }
        fileAttributesStr; // [requires key]

        //todo mixin for it
        /** @returns {Promise<Uint8Array>} */
        getThumbnail() {
            return FileAttributes.getThumbnail(this);
        };
        /** @returns {Promise<Uint8Array>} */
        getPreview() {
            return FileAttributes.getPreview(this);
        };

        get thumbnail() { // todo others
            return FileAttributes.of(this).byType(FileAttributes.Thumbnail.type);
        }

        get preview() {
            return FileAttributes.of(this).byType(FileAttributes.Preview.type);
        }
    }

    class FolderNode extends BasicFolderShareNode {
        [Symbol.toStringTag] = "FolderNode";
        constructor(node, masterKey) {
            super(node, masterKey);
            this.type = "folder";

            if (masterKey) {
                const {
                    name
                } = MegaUtil.parseEncodedNodeAttributes(node.attributes, this.key);
                this.name = name;
            } else {
                this.name = getEncryptedName(node.attributes, false);
            }
        }
        folders = [];
        files = [];

        _size = 0;
        get size() {
            return this._size; // todo: recursive calculate the size
        };
    }

    class RootFolderNode extends FolderNode {
        get [Symbol.toStringTag]() { return "RootFolderNode"; };
        constructor(node, masterKey) {
            super(node, masterKey);
            this.type = "rootFolder";
        }
        /** @return {RootFolderNode} */
        get root() {
            return this;
        }
    }


    class SharedFileNode {
        [Symbol.toStringTag] = "SharedFileNode";
        constructor(share, nodeInfo) {
            this.type = "sharedFile";
            this.id = share.id; // in fact it is not real file node id (for every new generated share url you get new id)

            if (share.decryptionKeyStr) {
                const decryptionKey = MegaUtil.megaBase64ToArrayBuffer(share.decryptionKeyStr);
                const {
                    iv,      // [unused][???] // probably it is needed for decryption (not implemented)
                    metaMac, // [unused][???]
                    key
                } = MegaUtil.decryptionKeyToParts(decryptionKey);
                this.key = key;
            } else {
                this.key = null;
            }

            const {
                size,
                nodeAttributesEncoded,
                downloadUrl,
                timeLeft,
            } = nodeInfo;

            this.size = size;
            this._meta = {downloadUrl, timeLeft};

            if (share.decryptionKeyStr) {
                const {
                    name,
                    serializedFingerprint
                } = MegaUtil.parseEncodedNodeAttributes(nodeAttributesEncoded, this.key);

                const {
                    modificationDate,
                    fileChecksum   // [unused][???]
                } = serializedFingerprint ? MegaUtil.parseFingerprint(serializedFingerprint) : {}; // Removed in ~2022?

                this.name = name;
                this.modificationDate = modificationDate;
            } else {
                this.modificationDate = null;
                this.name = getEncryptedName(nodeAttributesEncoded, false);
            }

        }


        type;
        id;
        size;

        key;
        name;
        modificationDate;
        get mtime() { // An alias
            return this.modificationDate;
        }
        get modificationDateFormatted() {
            return Util.secondsToFormattedString(this.modificationDate);
        }

        _meta;
        get timeLeft() {
            return this._meta.timeLeft;
        }
        get downloadUrl() {
            return this._meta.downloadUrl;
        }
    }

    class SharedMediaFileNode extends SharedFileNode {
        [Symbol.toStringTag] = "SharedMediaFileNode";
        constructor(share, nodeInfo) {
            super(share, nodeInfo);
            this.type = "sharedMediaFile";
            this.fileAttributesStr = nodeInfo.fileAttributesStr;
        }
        fileAttributesStr;

        //todo mixin for it
        /** @returns {Promise<Uint8Array>} */
        getThumbnail() {
            return FileAttributes.getThumbnail(this);
        };
        /** @returns {Promise<Uint8Array>} */
        getPreview() {
            return FileAttributes.getPreview(this);
        };
    }



    /**
     * Static factory methods for node creating
     *
     * Well, not the best JSDoc signatures, may be rework it later
     */
    class Nodes {

        /**
         * @param {string|URL} url
         * @returns {Promise<SharedFileNode|SharedMediaFileNode|RootFolderNode|FolderNode|FileNode|MediaFileNode>
         *     |Promise<(SharedFileNode|SharedMediaFileNode)[]|(RootFolderNode,FolderNode,FileNode,MediaFileNode)[]>}
         */
        static async of(url) {
            const share = Share.fromUrl(url);
            return share.isFolder ? Nodes.getFolderNodes(share) : Nodes.getSharedNode(share);
        }

        /**
         * @param {string|URL} url
         * @returns {Promise<SharedFileNode|SharedMediaFileNode|RootFolderNode|FolderNode|FileNode|MediaFileNode>}
         */
        static async node(url) {
            const share = Share.fromUrl(url);
            if (share.isFolder) {
                const nodes = await Nodes.getFolderNodes(share);
                if (nodes.selected) {
                    return nodes.selected;
                } else {
                    return nodes.root;
                }
            } else {
                return Nodes.getSharedNode(share);
            }
        }

        /**
         * @param {string|URL} url
         * @returns {Promise<(SharedFileNode|SharedMediaFileNode)[]|(RootFolderNode,FolderNode,FileNode,MediaFileNode)[]>}
         */
        static async nodes(url) {
            const share = Share.fromUrl(url);
            if (share.isFolder) {
                return Nodes.getFolderNodes(share);
            } else {
                return [await Nodes.getSharedNode(share)];
            }
        }

        /**
         * @param {Share} share
         * @returns {Promise<SharedFileNode|SharedMediaFileNode>}
         */
        static async getSharedNode(share) {
            const nodeInfo = await MegaApi.requestNodeInfo(share.id);
            if (nodeInfo.fileAttributesStr) {
                return new SharedMediaFileNode(share, nodeInfo);
            } else {
                return new SharedFileNode(share, nodeInfo);
            }
        }

        /**
         * @param {Share} share
         * @returns {Promise<(RootFolderNode,FolderNode,FileNode,MediaFileNode)[]>} [note] The array have mixed type content
         */
        static async getFolderNodes(share) {

            const masterKey = share.decryptionKeyStr ? MegaUtil.megaBase64ToArrayBuffer(share.decryptionKeyStr) : null;
            //logger.debug("[masterKey]", masterKey);

            const {
                nodes,
                rootId
            } = await MegaApi.requestFolderInfo(share.id);
            //logger.debug(`[requestFolderInfo("${share.id}").nodes]`, nodes);

            const folders = new Map(); // [note] JS's HashMap holds the insert order
            const files = [];


            // `masterKey` is null when the share has no specified key,
            // `node.decryptionKeyStr` is null when `k` of node info (from API) is an empty string (Mega's bug)
            //todo either handle it here (new classes for nodes without a key)
            // or in the node constructor modify its type to indicate this thing
            for (let i = 0; i < nodes.length; i++) {

                const node = nodes[i];
                let resultNode;

                node.parent = folders.get(node.parentId); // `undefine` for root

                if (node.type === "file") {
                    if (node.fileAttributesStr) {
                        resultNode = new MediaFileNode(node, masterKey);
                    } else {
                        resultNode = new FileNode(node, masterKey);
                    }
                    files.push(resultNode);

                    // the parent node is always located before the child node, no need to check its existence [1][note]
                    folders.get(resultNode.parentId).files.push(resultNode);

                } else if (node.type === "folder") {
                    if (node.id === rootId) { // or `if (i === 0)`
                        resultNode = new RootFolderNode(node, masterKey);
                    } else {
                        resultNode = new FolderNode(node, masterKey);
                        folders.get(resultNode.parentId).folders.push(resultNode); // see [1] note
                    }
                    folders.set(node.id, resultNode);
                }

                nodes[i] = null;
            }

            // todo: rework – make an iterable class with these getters
            const resultArray = [...folders.values(), ...files];
            const root = folders.get(rootId);
            const selected = resultArray.find(node => node.id === share.selectedId);
            Object.defineProperty(resultArray, "root",     { get: () => root });
            Object.defineProperty(resultArray, "selected", { get: () => selected });
            Object.defineProperty(resultArray, "folders",  { get: () => [...folders.values()] });
            Object.defineProperty(resultArray, "files",    { get: () => files });
            //todo .mediaNodes

            return resultArray;
        }

        static isMediaNode(node) {
            return node.type === "sharedMediaFile" || node.type === "mediaFile";
        }
    }

    /** @return {string|null} */
    function getEncryptedName(attributesEncoded, hasSerializedFingerprint) {
        if (!MegaApi.encryptedName) {
            return null;
        }
        // 3/4 since it's Base64; `MEGA{"c":"","n":""}`.length === 19; also it has padding;
        let count = Math.trunc(attributesEncoded.length * 3/4) - 19;
        if (hasSerializedFingerprint) {
            count = count - 28;
        }
        count = count - 1; // make dividable by 4
        if (count < 0) {
            count = 16;
        }
        console.log(count);
        return "█".repeat(count); // "\u2588"
    }

    const nodes = Nodes.nodes;
    const node  = Nodes.node;

    exports.FileAttributeBytes = FileAttributeBytes;
    exports.FileAttributes = FileAttributes;
    exports.MegaApi = MegaApi;
    exports.MegaUtil = MegaUtil;
    exports.Nodes = Nodes;
    exports.Share = Share;
    exports.Synchronization = synchronization$1;
    exports.Util = Util;
    exports.node = node;
    exports.nodes = nodes;

    return exports;

}({}, Util$1, MegaUtil$1, synchronization_js, GroupedTasks$1));
//# sourceMappingURL=mega.pure.js.map
