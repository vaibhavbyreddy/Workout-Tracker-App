// api/get-advice.js
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Grab the workout history sent from your app.js
    const { workoutHistory, systemPrompt } = req.body;
    
    // Vercel securely stores this API key in its dashboard settings
    const apiKey = process.env.GEMINI_API_KEY; 

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\nHere is my recent workout data: ${JSON.stringify(workoutHistory)}`
                    }]
                }]
            })
        });

        const data = await response.json();
        
        // Extract the text from Gemini's response structure
        const aiText = data.candidates[0].content.parts[0].text;
        
        // Send it back to your iPhone screen
        res.status(200).json({ advice: aiText });


    } 
    catch (error) {
        console.error("Gemini API Error:", error);
        // This sends the actual technical error back to your app for debugging
        res.status(500).json({ error: 'Failed to generate advice. Please try again.' });
    }
}