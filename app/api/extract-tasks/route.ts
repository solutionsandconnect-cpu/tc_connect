import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Extrait des tâches depuis une photo de notes manuscrites (vision Claude).
// Nécessite ANTHROPIC_API_KEY dans .env.local
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé ANTHROPIC_API_KEY absente. Ajoute-la dans .env.local pour activer la photo → tâches." },
      { status: 500 }
    )
  }

  try {
    const { image } = await req.json()
    const m = typeof image === 'string' ? /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(image) : null
    if (!m) return NextResponse.json({ error: 'Image invalide.' }, { status: 400 })
    const mediaType = m[1]
    const data = m[2]
    const today = new Date().toISOString().slice(0, 10)

    const client = new Anthropic({ apiKey })

    // Sortie structurée : { taches: [{ description, date }] }
    const params = {
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              taches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    date: { type: 'string' },
                  },
                  required: ['description', 'date'],
                  additionalProperties: false,
                },
              },
            },
            required: ['taches'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            {
              type: 'text',
              text:
                "Cette image est une photo de notes manuscrites listant des tâches d'un projet de développement.\n" +
                'Extrais chaque tâche distincte.\n' +
                'Pour chaque tâche :\n' +
                '- "description" : la tâche reformulée clairement et brièvement, en français.\n' +
                `- "date" : si une échéance est indiquée, convertis-la au format AAAA-MM-JJ ; sinon une chaîne vide. La date du jour est ${today} (sers-t'en pour les dates relatives ou les années manquantes).\n` +
                'Ignore le texte barré/raturé. Réponds uniquement avec le JSON demandé.',
            },
          ],
        },
      ],
    }

    // output_config n'est pas typé dans toutes les versions du SDK → cast volontaire
    const response = await client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming)
    const textBlock = response.content.find((b) => b.type === 'text') as { text?: string } | undefined
    const parsed = JSON.parse(textBlock?.text ?? '{"taches":[]}')
    const taches = Array.isArray(parsed?.taches) ? parsed.taches : []
    return NextResponse.json({ taches })
  } catch (e) {
    console.error('[extract-tasks]', e)
    const msg = e instanceof Error ? e.message : 'Erreur lors de l\'analyse'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
