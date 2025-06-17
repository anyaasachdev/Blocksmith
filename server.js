import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;
const SERPER_API_URL = "https://google.serper.dev/search";

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'blocksmith-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax' // Changed from 'strict' to 'lax' for better compatibility
    }
}));

// API Key Validation
const validateApiKeys = () => {
    const missingKeys = [];
    const invalidKeys = [];
    
    if (!process.env.SERPER_API_KEY) {
        missingKeys.push('SERPER_API_KEY');
    } else if (process.env.SERPER_API_KEY.trim() === '') {
        invalidKeys.push('SERPER_API_KEY (empty)');
    }
    
    if (missingKeys.length > 0 || invalidKeys.length > 0) {
        console.error('API Key Validation Failed:');
        if (missingKeys.length > 0) {
            console.error('- Missing keys:', missingKeys.join(', '));
        }
        if (invalidKeys.length > 0) {
            console.error('- Invalid keys:', invalidKeys.join(', '));
        }
        return false;
    }
    
    console.log('API Key Validation Passed');
    return true;
};

// API Helper Functions
const makeApiRequest = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Making API request to ${url}`);
            console.log('Request headers:', {
                ...options.headers,
                'X-API-KEY': options.headers['X-API-KEY'] ? '***' : 'missing',
                'Authorization': options.headers['Authorization'] ? '***' : 'missing'
            });
            
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText };
                }
                throw new Error(`API request failed: ${errorData.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request Error (attempt ${i + 1}/${retries}):`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
};

// Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        apiKeys: {
            serper: Boolean(process.env.SERPER_API_KEY)
        }
    });
});

app.post('/api/ai-search', async (req, res) => {
    try {
        const { resolution, side, argument } = req.body;

        if (!resolution || !side || !argument) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'Please provide resolution, side, and argument'
            });
        }

        // Validate Serper API key
        if (!process.env.SERPER_API_KEY) {
            return res.status(500).json({ 
                error: 'API configuration error',
                details: 'Serper API key is not configured'
            });
        }

        // Generate a simple search query
        const searchQuery = `${side === 'affirmative' ? 'evidence against' : 'evidence supporting'} ${argument} ${resolution}`;

        console.log('Search query:', searchQuery);
        console.log('Making request to Serper API with key:', process.env.SERPER_API_KEY.substring(0, 5) + '...');

        // Search using Serper
        try {
            const searchResults = await makeApiRequest(SERPER_API_URL, {
                method: 'POST',
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: searchQuery,
                    num: 10
                })
            });

            console.log('Serper API response received:', searchResults ? 'success' : 'empty');

            if (!searchResults || !searchResults.organic || searchResults.organic.length === 0) {
                return res.json({ 
                    success: true, 
                    noResults: true,
                    message: 'No relevant results found',
                    searchQuery: searchQuery
                });
            }

            // Process the top result
            const topResult = searchResults.organic[0];
            const enhancedEvidence = {
                quote: topResult.snippet,
                source: topResult.link,
                title: topResult.title,
                relevance: `This evidence from ${new URL(topResult.link).hostname} appears relevant to your search for ${side} evidence regarding "${argument}" in the context of "${resolution}".`
            };

            res.json({
                success: true,
                searchResults: searchResults.organic,
                enhancedEvidence,
                resolution,
                side,
                argument,
                searchQuery: searchQuery
            });
        } catch (serperError) {
            console.error('Serper API error:', serperError);
            return res.status(500).json({
                error: 'Search API error',
                details: serperError.message
            });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Search failed',
            details: error.message
        });
    }
});


app.get('*', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
if (validateApiKeys()) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
} else {
    console.error('Server startup failed due to missing or invalid API keys');
}