import { sample, type Traveller } from '@everycation/shared';

export const person = (id: string): Traveller => sample.travellers.find((t) => t.id === id) ?? sample.me;
/** "Oluwole Olarewaju" → "Wole O." as shown on cards. */
export const shortName = (id: string) => (id === 'wole' ? 'Wole O.' : person(id).name);
