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
