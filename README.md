# AI Construction Cost Estimator

A simple construction cost estimator. Enter project details yourself or use AI to fill in details from a description. Cost calculations run locally in your browser.

## Features

- Estimate costs from a city, area, number of floors, and construction quality.
- Use AI to read a project description and fill in supported details.
- Match common city-name spelling mistakes; choose **Other** when a city is not listed.
- Edit cities and planning rates in the Admin Dashboard. Configuration is saved in your browser.
- View a cost breakdown and compare estimates.

> Estimates are for planning only. Check current local rates and project requirements with qualified professionals.

## Run locally

**Requirements:** Node.js 20.6 or newer.

1. Clone this repository and open its folder in a terminal.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Copy the example environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Open `.env` and set `GROQ_API_KEY` to your Groq API key. The key stays in this local, ignored file—do not commit it.
5. Start the app:

   ```powershell
   npm start
   ```

6. Open [http://localhost:4173](http://localhost:4173).

The estimator works without an API key, but AI prompt parsing needs `GROQ_API_KEY`.

## Configuration

- `GROQ_API_KEY`: API key used by the local server for AI prompt parsing.
- `GROQ_MODEL`: Groq model name. Defaults to `openai/gpt-oss-20b`.
- `PORT`: local server port. Defaults to `4173`.
