// controllers/nft.controllers.js
import { JsonRpcProvider, Wallet, Contract, parseUnits } from "ethers";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ABI = require("../src/abi.json");

// ------------ ENV ------------
const {
  NFT_CONTRACT_ADDRESS,
  NFT_PRIVATE_KEY,
  NFT_RPC_URL,
} = process.env;

// Basic sanity checks (fail fast during boot)
if (!NFT_CONTRACT_ADDRESS) throw new Error("Missing NFT_CONTRACT_ADDRESS");
if (!NFT_PRIVATE_KEY) throw new Error("Missing NFT_PRIVATE_KEY");
if (!NFT_RPC_URL) throw new Error("Missing NFT_RPC_URL");

// ------------ ETHERS SINGLETON ------------
let _provider, _wallet, _contract;

function getClient() {
  if (_contract) return { provider: _provider, wallet: _wallet, contract: _contract };

  // v6: use classes directly (no ethers.providers)
  _provider = new JsonRpcProvider(NFT_RPC_URL);
  _wallet = new Wallet(NFT_PRIVATE_KEY, _provider);
  _contract = new Contract(NFT_CONTRACT_ADDRESS, ABI, _wallet);

  return { provider: _provider, wallet: _wallet, contract: _contract };
}

// ------------ FEE HELPERS (EIP-1559 safe) ------------
async function buildFeeOverrides(provider, minTipGwei = "25") {
  const feeData = await provider.getFeeData();
  const minTip = parseUnits(minTipGwei, "gwei"); // bigint

  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas >= minTip
      ? feeData.maxPriorityFeePerGas
      : minTip;

  const baseMaxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || minTip * 2n;

  const maxFeePerGas =
    baseMaxFeePerGas >= maxPriorityFeePerGas ? baseMaxFeePerGas : maxPriorityFeePerGas * 2n;

  return { maxPriorityFeePerGas, maxFeePerGas };
}

// ===================================================================
// Controllers
// ===================================================================

export const getContractAddress = async (req, res) => {
  try {
    res.status(200).json({ success: true, contractAddress: NFT_CONTRACT_ADDRESS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const mint = async (req, res) => {
  try {
    const { provider, contract } = getClient();
    const { address, tokenId, amount, tokenURI } = req.body;

    if (!address || tokenId == null || amount == null || !tokenURI) {
      return res.status(400).json({ success: false, error: "address, tokenId, amount, tokenURI are required" });
    }

    const fee = await buildFeeOverrides(provider);
    const tx = await contract.mintWithURI(
      address,
      BigInt(tokenId),
      BigInt(amount),
      tokenURI,
      {
        ...fee,
        gasLimit: 300000n,
      }
    );
    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.hash });
  } catch (error) {
    console.error("Mint error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const mintBatch = async (req, res) => {
  try {
    const { provider, contract } = getClient();
    const { to, tokenIds, amounts, tokenURIs } = req.body;

    if (!to || !Array.isArray(tokenIds) || !Array.isArray(amounts) || !Array.isArray(tokenURIs)) {
      return res.status(400).json({
        success: false,
        error: "to, tokenIds[], amounts[], tokenURIs[] are required",
      });
    }
    if (tokenIds.length !== amounts.length || tokenIds.length !== tokenURIs.length) {
      return res.status(400).json({
        success: false,
        error: "tokenIds, amounts, tokenURIs must have the same length",
      });
    }

    const fee = await buildFeeOverrides(provider);
    const tokenIdsBN = tokenIds.map((id) => BigInt(id));
    const amountsBN = amounts.map((a) => BigInt(a));

    const tx = await contract.mintBatchWithURI(to, tokenIdsBN, amountsBN, tokenURIs, {
      ...fee,
      gasLimit: 600000n,
    });

    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.hash });
  } catch (error) {
    console.error("MintBatch error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const balance = async (req, res) => {
  try {
    const { contract } = getClient();
    const { address, tokenId } = req.body;

    if (!address || tokenId == null) {
      return res.status(400).json({ success: false, error: "address and tokenId are required" });
    }

    // v6 returns bigint
    const bal = await contract.balanceOf(String(address), BigInt(tokenId));
    res.json({ success: true, tokenId, balance: bal.toString(), minted: bal > 0n });
  } catch (error) {
    console.error("BalanceOf error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const batchTransfer = async (req, res) => {
  try {
    const { provider, contract } = getClient();
    const { from, to, tokenIds, amounts, data } = req.body;

    if (!from || !to || !Array.isArray(tokenIds) || !Array.isArray(amounts)) {
      return res.status(400).json({
        success: false,
        error: "from, to, tokenIds[], amounts[] are required",
      });
    }
    if (tokenIds.length !== amounts.length) {
      return res.status(400).json({ success: false, error: "tokenIds and amounts must have the same length" });
    }

    const fee = await buildFeeOverrides(provider);
    const tokenIdsBN = tokenIds.map((id) => BigInt(id));
    const amountsBN = amounts.map((a) => BigInt(a));
    const dataBytes = data && typeof data === "string" ? data : "0x";

    const tx = await contract.safeBatchTransferFrom(from, to, tokenIdsBN, amountsBN, dataBytes, {
      ...fee,
      gasLimit: 500000n,
    });

    const receipt = await tx.wait();
    res.json({ success: true, txHash: receipt.hash });
  } catch (error) {
    console.error("batchTransfer error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const supply = async (req, res) => {
  try {
    const { contract } = getClient();
    const { id } = req.params;
    if (id == null) return res.status(400).json({ success: false, error: "id (tokenId) is required" });

    const total = await contract.totalSupply(BigInt(id));
    res.json({ success: true, tokenId: id, totalSupply: total.toString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uri = async (req, res) => {
  try {
    const { contract } = getClient();
    const { id } = req.params;
    if (id == null) return res.status(400).json({ success: false, error: "id (tokenId) is required" });

    // If your contract expects uint256 for uri(), cast to BigInt
    const tokenUri = await contract.uri(BigInt(id));
    res.json({ success: true, tokenId: id, uri: tokenUri });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const setTokenURI = async (req, res) => {
  try {
    const { provider, contract } = getClient();
    const { tokenId, tokenURI } = req.body;

    if (tokenId == null || !tokenURI) {
      return res.status(400).json({ success: false, error: "tokenId and tokenURI are required" });
    }

    const fee = await buildFeeOverrides(provider);
    const tx = await contract.setTokenURI(BigInt(tokenId), tokenURI, {
      ...fee,
      gasLimit: 500000n,
    });

    const receipt = await tx.wait();
    res.json({
      success: true,
      transactionHash: receipt.hash,
      tokenId,
      newURI: tokenURI,
    });
  } catch (err) {
    console.error("setTokenURI error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getAllNfts = async (req, res) => {
  try {
    const { contract } = getClient();

    // Expose whichever static IDs you want
    const tokenIds = [1n, 2n, 3n, 4n];

    const results = await Promise.all(
      tokenIds.map(async (id) => {
        try {
          const tokenUri = await contract.uri(id);
          return { tokenId: id.toString(), uri: tokenUri };
        } catch (err) {
          return { tokenId: id.toString(), error: err.message };
        }
      })
    );

    res.json({ success: true, items: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
