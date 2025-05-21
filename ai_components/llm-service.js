// ai_components/llm-service.js
const LLM_API_KEY_SESSION_STORAGE_KEY = 'llmApiKey'; // Ensure this matches admin.js

export async function generateImageFromPrompt(prompt) { 
    const apiKey = sessionStorage.getItem(LLM_API_KEY_SESSION_STORAGE_KEY);

    console.log(`LLM Service: Received prompt: "${prompt}" for actual API call.`);

    if (!apiKey) {
        console.error("LLM Service: API Key not found in session storage.");
        return Promise.reject(new Error("API Key not set. Please configure it in the admin panel."));
    }

    if (!prompt || prompt.trim() === "") {
        console.warn("LLM Service: Prompt was empty.");
        return Promise.reject(new Error("Prompt cannot be empty."));
    }

    const apiUrl = "https://api.openai.com/v1/images/generations";
    const requestBody = {
        // model: "dall-e-2", // Default, smaller, faster, cheaper
        // model: "dall-e-3", // Higher quality, more expensive, may require specific API access/tier
        prompt: prompt,
        n: 1, 
        size: "256x256", // For textures
        // response_format: "url" // default
        // quality: "standard" or "hd" (for dall-e-3)
        // style: "vivid" or "natural" (for dall-e-3)
    };

    console.log("LLM Service: Calling OpenAI API (images/generations)...");

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseBody = await response.json(); // Always try to parse JSON

        if (!response.ok) {
            console.error("LLM Service: API Error Response Data:", responseBody);
            let errorMessage = `API Error: ${response.status} ${response.statusText}`;
            if (responseBody && responseBody.error && responseBody.error.message) {
                errorMessage = responseBody.error.message;
            } else if (responseBody && typeof responseBody.detail === 'string') {
                errorMessage = responseBody.detail;
            }
            
            if (response.status === 401) {
                errorMessage = "Invalid API Key or authentication failed. Please check your key and OpenAI account status.";
            } else if (response.status === 429) {
                errorMessage = "Rate limit exceeded or quota issues with OpenAI API. Please check your usage and limits.";
            } else if (response.status === 400 && errorMessage.includes("billing")) {
                 errorMessage = "Billing issue with OpenAI account. Please check your payment method and billing status.";
            }


            throw new Error(errorMessage);
        }

        if (responseBody.data && responseBody.data.length > 0 && responseBody.data[0].url) {
            const imageUrl = responseBody.data[0].url;
            // OpenAI URLs for DALL-E generated images are temporary (expire after ~1 hour).
            // For persistent textures, the image would need to be downloaded and stored elsewhere,
            // or converted to a data URL if small enough. This is a next step consideration.
            console.log(`LLM Service: Image URL received: ${imageUrl}`);
            return imageUrl;
        } else {
            console.error("LLM Service: API response did not contain expected image URL.", responseBody);
            throw new Error("No image URL found in API response structure.");
        }

    } catch (error) {
        console.error("LLM Service: Fetch operation or JSON parsing error:", error);
        // Ensure the error re-thrown has a meaningful message for the UI
        throw error instanceof Error ? error : new Error(error.message || "Network error or issue parsing API response.");
    }
}
