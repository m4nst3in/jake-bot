export function parseBrDate(input: string): string | null {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(input))
        return null;
    const [dd, mm, yyyy] = input.split('/').map(Number);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900)
        return null;
    const iso = `${yyyy.toString().padStart(4, '0')}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d.getTime()) || d.getUTCFullYear() !== yyyy || (d.getUTCMonth() + 1) !== mm || d.getUTCDate() !== dd)
        return null;
    return iso;
}
export function formatBrDate(iso?: string | null): string | undefined {
    if (!iso)
        return undefined;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
        return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
}
