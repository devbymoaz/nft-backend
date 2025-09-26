import fetch from "node-fetch";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createCrossmintCollection = asyncHandler(async (req, res) => {
  // 🔒 Static API key and env
  const apiKey =
    "sk_production_27SycTijN2d3pY1H4huh3PP9geoF9XGFACVxGV9YXzBmHzBX49Mg3S6Mba3AFAV9kNGJUtpkpWQci3SnoKciZ2j5o6vdFb8RLBBrgNX6dtbniPi9g48VbX2qLKX6a5S1zYBnefjdUhy9nyKR33kQ8Po3BvFDdjMDJhyGzCVGkEoiJ1GAdaFqFVFDRxNd2UfnqdxbuF7c6Fe4UAqVTgXEaqa";
  const env = "www"; // or "staging" for test

  const { chain, fungibility, metadata } = req.body || {};

  // Basic validation
  if (!chain || !fungibility || !metadata) {
    return res
      .status(400)
      .json(
        new ApiResponse(400, null, "chain, fungibility and metadata are required")
      );
  }
  if (!metadata.name || !metadata.imageUrl || !metadata.description) {
    return res.status(400).json(
      new ApiResponse(
        400,
        null,
        "metadata.name, metadata.imageUrl and metadata.description are required"
      )
    );
  }

  const url = `https://${env}.crossmint.com/api/2022-06-09/collections`;

  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ chain, fungibility, metadata }),
  };

  const resp = await fetch(url, options);
  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    return res
      .status(resp.status)
      .json(new ApiResponse(resp.status, data, "Crossmint API error"));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, data, "Collection created successfully"));
});


export const createCrossmintTemplate = asyncHandler(async (req, res) => {
  // 🔒 Static config (match your example)
  const apiKey =
    "sk_production_27SycTijN2d3pY1H4huh3PP9geoF9XGFACVxGV9YXzBmHzBX49Mg3S6Mba3AFAV9kNGJUtpkpWQci3SnoKciZ2j5o6vdFb8RLBBrgNX6dtbniPi9g48VbX2qLKX6a5S1zYBnefjdUhy9nyKR33kQ8Po3BvFDdjMDJhyGzCVGkEoiJ1GAdaFqFVFDRxNd2UfnqdxbuF7c6Fe4UAqVTgXEaqa";
  const env = "www"; // or "www"
  const DEFAULT_COLLECTION_ID = "3e343b2d-993b-4755-962b-fcd64df72707"; 

  const { collectionId, onChain, supply, metadata } = req.body || {};

  // ---- Validation ----
  const finalCollectionId = (collectionId || DEFAULT_COLLECTION_ID || "").trim();
  if (!finalCollectionId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "collectionId is required"));
  }

  if (!onChain || typeof onChain.tokenId === "undefined") {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "onChain.tokenId is required"));
  }

  if (!supply || typeof supply.limit === "undefined") {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "supply.limit is required"));
  }

  if (
    !metadata ||
    !metadata.name ||
    !metadata.image ||
    !metadata.description
  ) {
    return res.status(400).json(
      new ApiResponse(
        400,
        null,
        "metadata.name, metadata.image and metadata.description are required"
      )
    );
  }

  const url = `https://${env}.crossmint.com/api/2022-06-09/collections/${finalCollectionId}/templates`;

  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      onChain: { tokenId: String(onChain.tokenId) }, // ensure string
      supply: { limit: Number(supply.limit) },       // ensure number
      metadata: {
        name: String(metadata.name),
        image: String(metadata.image),
        description: String(metadata.description),
      },
    }),
  };

  const resp = await fetch(url, options);

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    return res
      .status(resp.status)
      .json(new ApiResponse(resp.status, data, "Crossmint API error"));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, data, "Template created successfully"));
});


export const createCrossmintCollectionBasic = asyncHandler(async (req, res) => {
  // 🔒 Static API key and env per your request
  const apiKey =
    "sk_production_27SycTijN2d3pY1H4huh3PP9geoF9XGFACVxGV9YXzBmHzBX49Mg3S6Mba3AFAV9kNGJUtpkpWQci3SnoKciZ2j5o6vdFb8RLBBrgNX6dtbniPi9g48VbX2qLKX6a5S1zYBnefjdUhy9nyKR33kQ8Po3BvFDdjMDJhyGzCVGkEoiJ1GAdaFqFVFDRxNd2UfnqdxbuF7c6Fe4UAqVTgXEaqa";
  const env = "www"; // production

  const { chain, metadata, payments } = req.body || {};

  // ---- Required validation ----
  if (!chain) {
    return res.status(400).json(new ApiResponse(400, null, "chain is required"));
  }
  if (!metadata || !metadata.name || !metadata.imageUrl || !metadata.description) {
    return res.status(400).json(
      new ApiResponse(
        400,
        null,
        "metadata.name, metadata.imageUrl and metadata.description are required"
      )
    );
  }

  // ---- Optional payments validation (only if provided) ----
  let paymentsPayload = undefined;
  if (payments !== undefined) {
    const { price, recipientAddress, currency } = payments || {};
    if (!price || !recipientAddress || !currency) {
      return res.status(400).json(
        new ApiResponse(
          400,
          null,
          "payments.price, payments.recipientAddress and payments.currency are required when 'payments' is provided"
        )
      );
    }

    paymentsPayload = {
      price: String(price),                              // e.g., "0.01" or "10"
      recipientAddress: String(recipientAddress).trim(), // e.g., "0xabc123..."
      currency: String(currency).toLowerCase().trim(),   // e.g., "usd", "eur", "matic"
    };
  }

  const url = `https://${env}.crossmint.com/api/2022-06-09/collections`;

  const payload = {
    chain: String(chain),
    metadata: {
      name: String(metadata.name),
      imageUrl: String(metadata.imageUrl),
      description: String(metadata.description),
      ...(metadata.symbol ? { symbol: String(metadata.symbol) } : {}),
    },
    ...(paymentsPayload ? { payments: paymentsPayload } : {}),
  };

  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  };

  const resp = await fetch(url, options);
  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    return res
      .status(resp.status)
      .json(new ApiResponse(resp.status, data, "Crossmint API error"));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, data, "Collection created successfully"));
});


export const listCrossmintCollections = asyncHandler(async (req, res) => {


  const env = "staging"; // fixed per your curl
  const url = `https://${env}.crossmint.com/api/2022-06-09/collections`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-KEY": 'sk_staging_A4vDwESDiHUGX8H7ctjVmuEGBSoSyryNULSNKZsfGLu7mcGSRzP6daYwWjM2Lx5dyF6GerSrSTHP4shXYXBVhmZeiq2zPTVszKKMHUH8M6uN9io4SWecqR8AK1AZA3k4BwgnYtmJnUX9dw731yecCN6ADxUJCbKfLRs5i6WZ8NzTF987tTZkfSuqEtVBksj88LPms67LpHVgrieTR75VQJCF',
    },
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    return res
      .status(resp.status)
      .json(new ApiResponse(resp.status, data, "Crossmint API error"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Collections retrieved successfully"));
});