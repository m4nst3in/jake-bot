export const AREAS = [
    'Mov Call',
    'Design',
    'Eventos',
    'Suporte',
    'Recrutamento',
    'Jornalismo'
] as const;
export type Area = typeof AREAS[number];
export function isValidArea(a: string): a is Area { return (AREAS as readonly string[]).includes(a); }

// Normalize a user-provided area name to the canonical Area string.
// - Case-insensitive, ignores extra spaces and accents
// - Explicitly merges variants like "Movcall", "movcall", "mov call" into "Mov Call"
export function normalizeAreaName(input: string): Area | null {
    const base = (input || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Handle Mov Call variants
    const movcallKeys = new Set(['movcall', 'mov call', 'mov-call']);
    if (movcallKeys.has(base)) return 'Mov Call';
    // Generic matching for other areas (case/space-insensitive)
    const candidates: Record<string, Area> = {
        'design': 'Design',
        'eventos': 'Eventos',
        'suporte': 'Suporte',
        'recrutamento': 'Recrutamento',
        'jornalismo': 'Jornalismo'
    };
    if (candidates[base]) return candidates[base];
    // Try relaxed equality: remove spaces entirely and match against AREAS
    const compact = base.replace(/\s+/g, '');
    const found = (AREAS as readonly string[]).find(a => a.toLowerCase().replace(/\s+/g, '') === compact);
    return (found as Area | undefined) || null;
}
