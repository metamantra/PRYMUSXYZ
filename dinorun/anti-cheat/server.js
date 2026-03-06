const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors()); // Allows your website UI to talk to this server
app.use(express.json());

// This tracks when players start their run
const activeRuns = {};

// The max speed of the Dino game is roughly 15-20 points per second.
const MAX_POINTS_PER_SEC = 20;

// The server securely loads its own wallet from an environment variable
const serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY);

// 1. UI pings this when the user clicks PLAY
app.post('/start', (req, res) => {
    const { userAddress } = req.body;
    activeRuns[userAddress.toLowerCase()] = Date.now();
    res.json({ success: true, message: "Run started" });
});

// 2. UI pings this when the user CRASHES
app.post('/claim', async (req, res) => {
    const { userAddress, score, nonce } = req.body;
    const lowerAddress = userAddress.toLowerCase();

    // Check if they actually clicked play
    if (!activeRuns[lowerAddress]) {
        return res.status(400).json({ error: "No active run found." });
    }

    // ANTI-CHEAT MATH
    const timeElapsedSeconds = (Date.now() - activeRuns[lowerAddress]) / 1000;
    const maxPossibleScore = timeElapsedSeconds * MAX_POINTS_PER_SEC;

    if (score > maxPossibleScore) {
        delete activeRuns[lowerAddress]; // Wipe their run
        return res.status(403).json({ error: "Cheater detected! Score mathematically impossible." });
    }

    // Pass! Clear the run and sign the transaction
    delete activeRuns[lowerAddress];

    try {
        // Hash the data exactly like the Smart Contract does
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint256"],
            [userAddress, score, nonce]
        );
        
        // Sign it with the Server's private key
        const signature = await serverWallet.signMessage(ethers.getBytes(messageHash));
        
        res.json({ success: true, signature: signature });
    } catch (error) {
        res.status(500).json({ error: "Signing failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Prymus Arcade Server Running on port ${PORT}`));
