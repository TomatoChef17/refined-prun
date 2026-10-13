import { userData } from '@src/store/user-data';

// Company codes that FIO did not find in this session. They are not asked again until reload.
const notFound = new Set<string>();
const pending = new Set<string>();

interface FioCompany {
  UserName?: string | null;
}

// Player name of a partner company: a typed name or a name from FIO.
// The first call for a code starts a FIO request; the name shows when it arrives.
export function getPlayerName(code: string | null | undefined) {
  if (!code) {
    return undefined;
  }
  const name = userData.conts.players[code];
  if (name !== undefined) {
    return name;
  }
  void fetchPlayerName(code);
  return undefined;
}

export function setPlayerName(code: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length > 0) {
    userData.conts.players[code] = trimmed;
  } else {
    delete userData.conts.players[code];
    notFound.delete(code);
  }
}

async function fetchPlayerName(code: string) {
  if (pending.has(code) || notFound.has(code)) {
    return;
  }
  pending.add(code);
  try {
    const response = await fetch(`https://rest.fnar.net/company/code/${encodeURIComponent(code)}`);
    if (!response.ok) {
      notFound.add(code);
      return;
    }
    const company = (await response.json()) as FioCompany;
    const name = company.UserName ?? '';
    if (name.length === 0) {
      notFound.add(code);
      return;
    }
    // A name typed while the request ran wins.
    userData.conts.players[code] ??= name;
  } catch {
    notFound.add(code);
  } finally {
    pending.delete(code);
  }
}
