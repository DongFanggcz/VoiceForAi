const crypto = require("crypto");
const https = require("https");

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function randomNonce() {
  return crypto.randomBytes(8).toString("hex");
}

async function createToken(accessKeyId, accessKeySecret) {
  const params = {
    AccessKeyId: accessKeyId,
    Action: "CreateToken",
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomNonce(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    Version: "2019-02-28"
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const stringToSign = `POST&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret + "&")
    .update(stringToSign)
    .digest("base64");

  params.Signature = signature;

  const body = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const result = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "nls-meta.cn-shanghai.aliyuncs.com",
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("解析 Token 响应失败: " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  if (!result.Token || !result.Token.Id) {
    const msg = result.Message || result.Code || "CreateToken 失败";
    throw new Error(msg);
  }
  return {
    token: result.Token.Id,
    expireTime: result.Token.ExpireTime,
    userId: result.Token.UserId
  };
}

module.exports = { createToken };
