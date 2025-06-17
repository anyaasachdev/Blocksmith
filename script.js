// Blocksmith - Debate Evidence Tool JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const resolutionInput = document.getElementById('resolution-input');
    const affirmativeBtn = document.getElementById('affirmative');
    const negativeBtn = document.getElementById('negative');
    const opponentArgument = document.getElementById('opponent-argument');
    const searchEvidenceBtn = document.getElementById('search-evidence');
    const resultsSection = document.querySelector('.results-section');
    const evidenceQuoteText = document.getElementById('evidence-quote-text');
    const sourceLink = document.getElementById('source-link');
    const citation = document.getElementById('citation');
    const copyBlockBtn = document.getElementById('copy-block');
    const verificationBadges = document.querySelectorAll('.badge');

    // State variables
    let selectedSide = null;
    let currentEvidence = null;
    
    // Event Listeners
    affirmativeBtn.addEventListener('click', () => selectSide('affirmative'));
    negativeBtn.addEventListener('click', () => selectSide('negative'));
    searchEvidenceBtn.addEventListener('click', searchEvidence);
    copyBlockBtn.addEventListener('click', copyBlock);

    function selectSide(side) {
        selectedSide = side;
        if (side === 'affirmative') {
            affirmativeBtn.classList.add('active');
            negativeBtn.classList.remove('active');
        } else {
            negativeBtn.classList.add('active');
            affirmativeBtn.classList.remove('active');
        }
    }

    function generateSearchQuery(resolution, argument, side) {
        let searchQuery = '';
        const resolutionKeywords = extractKeywords(resolution, 4);
        const argumentKeywords = extractKeywords(argument, 3);
        const searchDirection = side === 'affirmative' ? 'evidence against' : 'evidence supporting';
        
        searchQuery = `${searchDirection} ${argumentKeywords.join(' ')} ${resolutionKeywords.join(' ')}`;
        
        if (searchQuery.length > 60) {
            searchQuery = searchQuery.substring(0, 60);
        }
        
        console.log('Generated search query:', searchQuery);
        return searchQuery;
    }

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

    function searchEvidence() {
        const resolution = resolutionInput.value.trim();
        const argument = opponentArgument.value.trim();
        
        console.log('=== SEARCH INITIATED ===');
        console.log('Resolution:', resolution);
        console.log('Side:', selectedSide);
        console.log('Argument:', argument);

        if (!resolution) {
            showNotification('Please enter a debate resolution.');
            return;
        }

        if (!selectedSide) {
            showNotification('Please select your side (Affirmative or Negative).');
            return;
        }

        if (!argument) {
            showNotification('Please enter the opponent\'s argument.');
            return;
        }

        if (resolution.length > 200 || argument.length > 200) {
            showNotification('Resolution or argument is too long. Please be more concise.');
            return;
        }

        // Show loading state
        searchEvidenceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        searchEvidenceBtn.disabled = true;
        
        const searchQuery = generateSearchQuery(resolution, argument, selectedSide);
        console.log('Generated search query:', searchQuery);
        
        console.log('Sending search request:', {
            resolution: resolution,
            side: selectedSide,
            argument: argument
        });

        // FIX 1: Use correct API endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        // Update the API endpoint in your script.js
        // Change from: '/.netlify/functions/ai-search'
        // To: '/api/ai-search'
        
        // Find and replace the fetch URL in your existing code
        // Old: fetch('/.netlify/functions/ai-search', ...)
        // New: fetch('/api/ai-search', ...)
        
        // Around line 126, replace the fetch call with:
        fetch('/api/ai-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resolution: resolution,
                side: selectedSide,
                argument: argument
            }),
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            console.log('Response status:', response.status);
            console.log('Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                // FIX 2: Better error handling for non-JSON responses
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return response.json().then(data => {
                        console.error('Error response:', data);
                        throw new Error(data.details || data.error || `Server error: ${response.status}`);
                    });
                } else {
                    return response.text().then(text => {
                        console.error('Non-JSON error response:', text);
                        throw new Error(`Server error: ${response.status} ${response.statusText}`);
                    });
                }
            }
            return response.json();
        })
        .then(data => {
            console.log('=== SEARCH RESPONSE RECEIVED ===');
            console.log('Response data structure:', Object.keys(data || {}));
            console.log('Full response data:', data);
            
            // Reset button state
            searchEvidenceBtn.innerHTML = 'Find Evidence <i class="fas fa-search"></i>';
            searchEvidenceBtn.disabled = false;

            // Show results section
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            // FIX 5: Add null checks for API response
            if (!data) {
                showNotification('No response received from server.');
                displayNoResultsMessage(resolution, argument);
                return;
            }
            
            if (data.noResults) {
                console.log('No results found');
                showNotification(`No relevant evidence found for: "${data.searchQuery || 'your search'}". Try refining your search terms.`);
                displayNoResultsMessage(resolution, argument);
                return;
            }

            console.log('Processing search results...');
            
            if (data.searchResults && data.searchResults.length > 0) {
                console.log('Using verifyAndDisplayEvidence with searchResults');
                verifyAndDisplayEvidence({
                    organic: data.searchResults
                }, resolution, argument);
            } 
            else if (data.enhancedEvidence) {
                console.log('Using displayEvidence with enhancedEvidence');
                displayEvidence(data.enhancedEvidence, resolution, argument);
            } 
            else {
                console.error('Unexpected response format:', data);
                showNotification('Received response but no usable evidence was found.');
                displayNoResultsMessage(resolution, argument);
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('=== SEARCH ERROR ===');
            console.error('Error fetching evidence:', error);
            searchEvidenceBtn.innerHTML = 'Find Evidence <i class="fas fa-search"></i>';
            searchEvidenceBtn.disabled = false;
            
            // FIX 6: Better error propagation
            let errorMessage = 'Search failed. Please try again.';
            if (error.name === 'AbortError') {
                errorMessage = 'Search timed out. Please try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showNotification(errorMessage, true);
            displayErrorMessage(errorMessage, resolution, argument);
        });
    }
    
    function displayNoResultsMessage(resolution, argument) {
        evidenceQuoteText.textContent = 'No relevant evidence found for your search.';
        sourceLink.href = '#';
        sourceLink.textContent = 'No source available';
        citation.textContent = '';
        
        document.querySelectorAll('.badge').forEach(badge => {
            badge.classList.remove('verified');
        });
        
        copyBlockBtn.disabled = true;
    }
    
    function displayErrorMessage(errorMessage, resolution, argument) {
        resultsSection.classList.remove('hidden');
        
        evidenceQuoteText.innerHTML = `<div class="error-text"><i class="fas fa-exclamation-triangle"></i> ${errorMessage}</div>`;
        evidenceQuoteText.innerHTML += '<p>Try these alternatives:</p><ul><li>Refresh the page and try again</li><li>Use more specific search terms</li><li>Try a different resolution or argument</li></ul>';
        
        sourceLink.href = '#';
        sourceLink.textContent = 'No source available';
        citation.textContent = '';
        
        document.querySelectorAll('.badge').forEach(badge => {
            badge.classList.remove('verified');
        });
        
        copyBlockBtn.disabled = true;
    }

    function verifyAndDisplayEvidence(data, resolution, argument) {
        verificationBadges.forEach(badge => {
            badge.classList.remove('verified');
        });

        if (!data || !data.organic || data.organic.length === 0) {
            showNotification('No relevant evidence found. Try refining your search.');
            displayNoResultsMessage(resolution, argument);
            return;
        }

        const topResults = data.organic.slice(0, 10);
        let bestResult = topResults[0];
        let bestScore = 0;
        
        for (const result of topResults) {
            let currentScore = 0;
            
            if (isRelevantToResolution(result, resolution)) currentScore += 2;
            if (isRelevantToArgument(result, argument)) currentScore += 3;
            if (isSourceReliable(result)) currentScore += 2;
            
            if (result.snippet) {
                const directResponseIndicators = [
                    'study shows', 'research indicates', 'experts say', 
                    'according to', 'findings suggest', 'demonstrates',
                    'proves', 'evidence shows', 'concludes'
                ];
                
                const hasDirectResponse = directResponseIndicators.some(indicator => 
                    result.snippet.toLowerCase().includes(indicator)
                );
                if (hasDirectResponse) currentScore += 3;
                
                const snippetLength = result.snippet.length;
                if (snippetLength > 300) currentScore += 5;
                else if (snippetLength > 200) currentScore += 4;
                else if (snippetLength > 100) currentScore += 2;
                else if (snippetLength > 50) currentScore += 1;
                
                const sentences = result.snippet.split(/[.!?]+/).filter(s => s.trim().length > 0);
                const completeSentences = sentences.filter(s => 
                    s.trim().length > 30 &&
                    s.match(/^[A-Z]/) &&
                    s.match(/[.!?]$/) &&
                    (s.toLowerCase().includes(argument.toLowerCase()) ||
                     directResponseIndicators.some(indicator => s.toLowerCase().includes(indicator)))
                );
                
                currentScore += completeSentences.length * 4;
                
                if (completeSentences.length >= 2) currentScore += 3;
                if (completeSentences.length >= 3) currentScore += 2;
                
                const scholarlyTerms = ['study', 'research', 'analysis', 'findings', 'conclusion', 'evidence', 'data', 'results', 'experts', 'scholars', 'academic', 'peer-reviewed'];
                const hasScholarlyTerms = scholarlyTerms.some(term => 
                    result.snippet.toLowerCase().includes(term)
                );
                if (hasScholarlyTerms) currentScore += 3;
            }
            
            const content = (result.title + ' ' + result.snippet).toLowerCase();
            const resolutionKeywords = resolution.toLowerCase().split(' ')
                .filter(word => word.length > 3 && !['the', 'and', 'that', 'this', 'with'].includes(word));
            const argumentKeywords = argument.toLowerCase().split(' ')
                .filter(word => word.length > 3 && !['the', 'and', 'that', 'this', 'with'].includes(word));
            
            const resolutionMatches = resolutionKeywords.filter(keyword => content.includes(keyword)).length;
            const argumentMatches = argumentKeywords.filter(keyword => content.includes(keyword)).length;
            
            currentScore += resolutionMatches * 0.5;
            currentScore += argumentMatches * 0.5;
            
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestResult = result;
            }
        }
        
        const resolutionRelevant = isRelevantToResolution(bestResult, resolution);
        if (resolutionRelevant) {
            document.getElementById('resolution-relevance').classList.add('verified');
        }
        
        const argumentRelevant = isRelevantToArgument(bestResult, argument);
        if (argumentRelevant) {
            document.getElementById('argument-relevance').classList.add('verified');
        }
        
        const sourceReliable = isSourceReliable(bestResult);
        if (sourceReliable) {
            document.getElementById('source-reliability').classList.add('verified');
        }
        
        currentEvidence = {
            quote: bestResult.snippet,
            source: bestResult.link,
            title: bestResult.title,
            resolution: resolution,
            argument: argument,
            side: selectedSide
        };
        
        displayEvidence(bestResult, resolution, argument);
        
        window.allEvidence = topResults.map(result => ({
            title: result.title,
            snippet: result.snippet,
            link: result.link
        }));
        
        if (topResults.length > 1) {
            addEvidenceNavigation(topResults, resolution, argument);
        }
    }
    
    function addEvidenceNavigation(results, resolution, argument) {
        let navContainer = document.querySelector('.evidence-navigation');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.className = 'evidence-navigation';
            navContainer.innerHTML = `
                <p>Found ${results.length} relevant sources. Navigate between them:</p>
                <div class="nav-buttons"></div>
            `;
            document.querySelector('.evidence-card').appendChild(navContainer);
            // FIX 3: Removed undefined aiAnalysis variable reference
        } else {
            navContainer.querySelector('.nav-buttons').innerHTML = '';
        }
        
        const navButtons = navContainer.querySelector('.nav-buttons');
        results.forEach((result, index) => {
            const button = document.createElement('button');
            button.className = 'btn nav-btn';
            button.textContent = index + 1;
            button.addEventListener('click', () => {
                const resolutionRelevant = isRelevantToResolution(result, resolution);
                const argumentRelevant = isRelevantToArgument(result, argument);
                const sourceReliable = isSourceReliable(result);
                
                document.getElementById('resolution-relevance').classList.toggle('verified', resolutionRelevant);
                document.getElementById('argument-relevance').classList.toggle('verified', argumentRelevant);
                document.getElementById('source-reliability').classList.toggle('verified', sourceReliable);
                
                displayEvidence(result, resolution, argument);
                
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
            navButtons.appendChild(button);
        });
        
        navButtons.querySelector('.nav-btn').classList.add('active');
    }
    
    function isRelevantToResolution(result, resolution) {
        const keywords = resolution.toLowerCase().split(' ');
        const content = (result.title + ' ' + result.snippet).toLowerCase();
        
        let matchCount = 0;
        for (const keyword of keywords) {
            if (keyword.length < 4 || ['the', 'and', 'that', 'this', 'with'].includes(keyword)) {
                continue;
            }
            
            if (content.includes(keyword)) {
                matchCount++;
            }
        }
        
        return matchCount >= 2;
    }
    
    function isRelevantToArgument(result, argument) {
        const keywords = argument.toLowerCase().split(' ');
        const content = (result.title + ' ' + result.snippet).toLowerCase();
        
        for (const keyword of keywords) {
            if (keyword.length < 4 || ['the', 'and', 'that', 'this', 'with'].includes(keyword)) {
                continue;
            }
            
            if (content.includes(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    function isSourceReliable(result) {
        const url = result.link;
        if (!url) return false;
        
        try {
            const domain = new URL(url).hostname;
            
            const reliableDomains = [
                '.edu', '.gov', 'nytimes.com', 'wsj.com', 'reuters.com', 'bbc.com', 'npr.org',
                'washingtonpost.com', 'economist.com', 'nature.com', 'science.org', 'jstor.org'
            ];
            
            for (const reliableDomain of reliableDomains) {
                if (domain.includes(reliableDomain)) {
                    return true;
                }
            }
            
            return url.startsWith('https');
        } catch (e) {
            return false;
        }
    }

    function displayEvidence(result, resolution, argument) {
        console.log('displayEvidence called with:', result);
        console.log('Results section hidden?', resultsSection.classList.contains('hidden'));
        
        // FIX 4: Use consistent property names (snippet instead of quote)
        const evidence = {
            quote: result.snippet || 'No quote available',
            source: result.link || 'No source available',
            citation: result.title ? `${result.title}. Retrieved from ${result.link}` : `Retrieved from ${result.link}`
        };
    
        evidenceQuoteText.textContent = evidence.quote;
        sourceLink.href = evidence.source;
        sourceLink.textContent = result.title || evidence.source;
        citation.textContent = evidence.citation;
        
        copyBlockBtn.disabled = false;
        
        const resolutionRelevant = isRelevantToResolution(result, resolution);
        const argumentRelevant = isRelevantToArgument(result, argument);
        const sourceReliable = isSourceReliable(result);
        
        document.getElementById('resolution-relevance').classList.toggle('verified', resolutionRelevant);
        document.getElementById('argument-relevance').classList.toggle('verified', argumentRelevant);
        document.getElementById('source-reliability').classList.toggle('verified', sourceReliable);
        
        currentEvidence = {
            quote: evidence.quote,
            source: evidence.source,
            citation: evidence.citation,
            resolution: resolution,
            side: selectedSide,
            argument: argument,
            verification: {
                resolutionRelevant,
                argumentRelevant,
                sourceReliable
            }
        };
    }

    function copyBlock() {
        if (!currentEvidence) {
            showNotification('No evidence to copy. Please search for evidence first.');
            return;
        }

        const resolution = currentEvidence.resolution;
        const side = currentEvidence.side;
        const argument = currentEvidence.argument;
        const quote = currentEvidence.quote;
        const source = currentEvidence.source;

        const formattedBlock = `RESOLUTION: ${resolution}\n` +
                             `SIDE: ${side === 'affirmative' ? 'Affirmative' : 'Negative'}\n` +
                             `RESPONDING TO: ${argument}\n\n` +
                             `${quote}\n\n` +
                             `Source: ${source}`;

        navigator.clipboard.writeText(formattedBlock)
            .then(() => {
                showNotification('Block copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                showNotification('Failed to copy block. Please try again.');
            });
    }

    function displayAIEnhancedEvidence(enhancedEvidence, searchResults, resolution, argument) {
        evidenceQuoteText.textContent = enhancedEvidence.quote;
        sourceLink.href = enhancedEvidence.source;
        sourceLink.textContent = enhancedEvidence.source;
        citation.textContent = `Retrieved from ${enhancedEvidence.source}`;
        
        copyBlockBtn.disabled = false;
        
        currentEvidence = {
            quote: enhancedEvidence.quote,
            source: enhancedEvidence.source,
            citation: `Retrieved from ${enhancedEvidence.source}`,
            resolution: resolution,
            side: selectedSide,
            argument: argument,
            timestamp: new Date().toISOString()
        };
        
        document.querySelectorAll('.badge').forEach(badge => {
            badge.classList.add('verified');
        });
        
        if (enhancedEvidence.relevance) {
            let aiAnalysis = document.querySelector('.ai-analysis');
            if (!aiAnalysis) {
                aiAnalysis = document.createElement('div');
                aiAnalysis.className = 'ai-analysis';
                aiAnalysis.innerHTML = `
                    <h4>AI Analysis</h4>
                    <p id="ai-relevance-text"></p>
                `;
                document.querySelector('.evidence-block').appendChild(aiAnalysis);
            }
            document.getElementById('ai-relevance-text').textContent = enhancedEvidence.relevance;
        }
        
        let aiBadge = document.getElementById('ai-enhanced');
        if (!aiBadge) {
            aiBadge = document.createElement('div');
            aiBadge.id = 'ai-enhanced';
            aiBadge.className = 'badge verified';
            aiBadge.innerHTML = '<i class="fas fa-robot"></i> AI Enhanced';
            document.querySelector('.verification-badges').appendChild(aiBadge);
        } else {
            aiBadge.classList.add('verified');
        }
        
        if (searchResults && searchResults.length > 1) {
            addEvidenceNavigation(searchResults, resolution, argument);
        }
    }
    
    function showNotification(message, isError = false, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        if (isError) {
            notification.classList.add('error');
        }
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
});
