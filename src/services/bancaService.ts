import { BancaRepository } from '../repositories/bancaRepository.ts';
export class BancaService {
  constructor(private repo = new BancaRepository()) {}
  create(channelId: string, name: string, staffId: string) { return this.repo.create(channelId, name, staffId); }
  getByChannel(channelId: string) { return this.repo.getByChannel(channelId); }
}