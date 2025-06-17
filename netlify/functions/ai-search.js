import fetch from 'node-fetch';
// Replace the import statements at the top:
// import dotenv from 'dotenv';
// dotenv.config();

// With:
// Remove dotenv entirely since Netlify provides environment variables directly
// Just use process.env.SERPER_API_KEY directly

// At the very end of the file, make sure you have:
const SERPER_API_URL = "https://google.serper.dev/search";

// Helper function to extract important keywords
function extractKeywords(text, maxKeywords) {
    if (!text) return [];
    
    const fillerWords = ['the', 'a', 'an', 'that', 'this', 'these', 'those', 'is', 'are', 'was', 'were', 
                        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'should', 
                        'would', 'could', 'will', 'shall', 'may', 'might', 'must', 'can', 'resolved', 
                        'debate', 'argument', 'therefore', 'thus', 'hence', 'because', 'since'];
    
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    const keywords = words
        .filter(word => !fillerWords.includes(word) && word.length > 3)
        .sort((a, b) => b.length - a.length)
        .slice(0, maxKeywords);
    
    return keywords;
}

// Add after the extractKeywords function
function generateSearchQuery(resolution, argument, side) {
    const resolutionKeywords = extractKeywords(resolution, 4);
    const argumentKeywords = extractKeywords(argument, 3);
    const searchDirection = side === 'affirmative' ? 'evidence against' : 'evidence supporting';
    
    let searchQuery = `${searchDirection} ${argumentKeywords.join(' ')} ${resolutionKeywords.join(' ')}`;
    
    if (searchQuery.length > 60) {
        searchQuery = searchQuery.substring(0, 60);
    }
    
    return searchQuery;
}

async function makeApiRequest(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function analyzeSearchResults(resolution, argument, side, results) {
    if (!results || results.length === 0) {
        return null;
    }
    
    const topResult = results[0];
    return {
        quote: topResult.snippet || 'No quote available',
        source: topResult.link || 'No source available',
        citation: topResult.title ? `${topResult.title}. Retrieved from ${topResult.link}` : `Retrieved from ${topResult.link}`,
        relevance: `This evidence from ${new URL(topResult.link).hostname} appears relevant to your search for ${side} evidence regarding "${argument}" in the context of "${resolution}".`
    };
}

const makeApiRequest = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                const errorText = await response.text();
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
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
};

function analyzeSearchResults(resolution, argument, side, searchResults) {
    if (!searchResults || searchResults.length === 0) {
        return "No relevant evidence found for this argument.";
    }
    
    // Simple analysis - combine snippets from search results
    const snippets = searchResults
        .filter(result => result.snippet)
        .map(result => result.snippet)
        .slice(0, 3)
        .join(' ');
    
    return snippets || "Evidence found but no detailed analysis available.";
}

// Change from CommonJS export to ES6 export
const handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        const body = JSON.parse(event.body);
        const { resolution, side, argument } = body;

        if (!resolution || !side || !argument) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required fields',
                    details: 'Please provide resolution, side, and argument'
                })
            };
        }

        if (!process.env.SERPER_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'Serper API key is missing'
                })
            };
        }

        const searchQuery = generateSearchQuery(resolution, argument, side);
        
        const searchResults = await makeApiRequest(SERPER_API_URL, {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: searchQuery,
                num: 5
            })
        });
        
        if (!searchResults.organic || searchResults.organic.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    noResults: true,
                    searchQuery: searchQuery
                })
            };
        }

        const enhancedEvidence = analyzeSearchResults(
            resolution,
            argument,
            side,
            searchResults.organic
        );
        
        const responseBody = {
            enhancedEvidence,
            searchResults: searchResults.organic,
            searchQuery
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseBody)
        };
    } catch (error) {
        console.error('=== SERVER ERROR ===');
        console.error('Error details:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Server error',
                details: error.message
            })
        };
    }
};

exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ message: 'Function is working!' })
    };
};