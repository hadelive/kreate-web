import { NextApiRequest, NextApiResponse } from "next";

import {
  TEIKI_CONTENT_DEFAULT_KEY_ID,
  TEIKI_CONTENT_KEYS,
} from "../../../../../config/server";

import * as crypt from "@/modules/crypt";
import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream
  },
};

type Envelope = crypt.CipherMeta & { data: crypt.Base64 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    ClientError.assert(req.method === "POST", {
      _debug: "invalid http method",
    });

    const { kid, key } = crypt.selectKey(
      TEIKI_CONTENT_KEYS,
      TEIKI_CONTENT_DEFAULT_KEY_ID
    );
    const iv = crypt.randomIv();
    const cipher = crypt.createCipher(key, iv);

    const chunks: Uint8Array[] = [];
    for await (const chunk of req.pipe(cipher)) chunks.push(chunk);
    const data = Buffer.concat(chunks).toString(crypt.Base64);

    const ev: Envelope = {
      enc: "proto",
      kid,
      iv: iv.toString(crypt.Base64),
      aut: cipher.getAuthTag().toString(crypt.Base64),
      data,
    };

    sendJson(res.status(200), ev);
  } catch (error) {
    apiCatch(req, res, error);
  }
}
