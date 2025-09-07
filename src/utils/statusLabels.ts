export function rppStatusLabel(status: string): string {
    switch (status) {
        case 'PENDING': return 'aguardando';
        case 'ACCEPTED': return 'ativo';
        case 'REJECTED': return 'negado';
        case 'REMOVED': return 'removido';
        default: return status.toLowerCase();
    }
}
