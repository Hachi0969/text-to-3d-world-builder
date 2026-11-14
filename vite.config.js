import { defineConfig, loadEnv } from 'vite';

const MODEL = 'gemini-3.5-flash';

const SYSTEM_PROMPT = `You are the engine of a beginner-friendly text-to-3D world builder.
The user describes something to add or change in a 3D world. You answer ONLY with JSON.

World: Y is up, ground is the plane y=0, X/Z span roughly -14..14 (the visible area). Units are meters-ish; a person is ~1.8 tall, a house ~4 wide.

JSON schema:
{
  "message": string,                 // one short friendly sentence telling the beginner what you did
  "clearObjects": boolean,           // true only if user asks to remove/clear everything they added
  "removeNames": string[],           // names of existing custom objects to delete (from the provided list)
  "environment": {                   // OPTIONAL: only include keys the user wants to change
    "sky": "#rrggbb", "fog": "#rrggbb",
    "ambientColor": "#rrggbb", "ambientIntensity": number (0.3-3),
    "sunColor": "#rrggbb", "sunIntensity": number (0-4),
    "ground": "#rrggbb",
    "rain": boolean
  },
  "objects": [                       // things to add, max 12
    {
      "name": string,                // short lowercase name e.g. "red house"
      "position": [x, z],            // where to place it on the ground
      "rotationY": number,           // radians, optional
      "scale": number,               // optional, default 1
      "parts": [                     // 1-40 primitives that together form the object
        {
          "shape": "box"|"sphere"|"cylinder"|"cone"|"torus",
          "size": number[],          // box:[w,h,d] sphere:[radius] cylinder:[radiusTop,radiusBottom,height] cone:[radius,height] torus:[radius,tube]
          "position": [x,y,z],       // relative to the object's origin; y=0 is the ground, so a box of height h sitting on the ground has y=h/2
          "rotation": [x,y,z],       // radians, optional
          "color": "#rrggbb",
          "emissive": boolean        // optional, true for lights/windows/fire/sun that should glow
        }
      ]
    }
  ]
}

Rules:
- Build recognizable objects from several well-placed primitives (a house = box walls + cone/pyramid roof + door + windows; a car = body box + cabin box + 4 cylinder wheels rotated [0,0,1.5708]; a lake = very flat wide cylinder, e.g. size [6,6,0.1] at y=0.05 in blue).
- Parts must be positioned so they touch and look assembled; nothing floating unless intended.
- Spread multiple objects out so they do not overlap each other or existing objects. Prefer positions within -13..13.
- Use nice natural colors. Use the user's language for the "message" if it is not English.
- For weather/time requests use "environment". Night: sky #081426, ambientIntensity 0.5, sunIntensity 0.3. Sunset: sky #f29b72. Day: sky #9bbdce, ambientIntensity 2, sunIntensity 3. Snow ground: #f0f4f8.
- If the request is impossible or unclear, still do your best simple version and explain in "message".
- Never output anything except the JSON object.`;

function geminiProxy(apiKey) {
  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/generate', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (req.method !== 'POST') return send(405, { error: 'POST only' });
        if (!apiKey) {
          return send(500, {
            error: 'GEMINI_API_KEY is missing. Create a .env file (see .env.example) and restart npm run dev.'
          });
        }

        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 20000) return send(413, { error: 'Request too large' });
        }

        let prompt, existing;
        try {
          ({ prompt, existing = [] } = JSON.parse(raw));
          if (typeof prompt !== 'string' || !prompt.trim()) throw new Error();
        } catch {
          return send(400, { error: 'Invalid request' });
        }
        prompt = prompt.slice(0, 600);

        const userText =
          `Existing custom objects in the world: ${JSON.stringify(existing.slice(0, 60))}\n` +
          `User request: ${prompt}`;

        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: userText }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.7,
                  thinkingConfig: { thinkingBudget: 0 }
                }
              }),
              signal: AbortSignal.timeout(45000)
            }
          );

          const data = await r.json();
          if (!r.ok) {
            return send(502, { error: data?.error?.message || 'Gemini request failed' });
          }

          const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
          let scene;
          try {
            scene = JSON.parse(text);
          } catch {
            return send(502, { error: 'The AI returned an invalid answer. Please try again.' });
          }
          send(200, scene);
        } catch (err) {
          send(502, { error: `Could not reach the AI: ${err.message}` });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [geminiProxy(env.GEMINI_API_KEY)] };
});
