import $style from '../inv-search.module.css';
import css from '@src/utils/css-utils.module.css';
import PrunButton from '@src/components/PrunButton.vue';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { observeDescendantListChanged } from '@src/utils/mutation-observer';
import { oneMicrotask } from '@src/utils/one-microtask';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';
import { userData } from '@src/store/user-data';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlayerName, setPlayerName } from './fio-players';

type ContractKind = 'BUY' | 'SELL' | 'SHIP' | 'LOAN' | 'OTHER';
const kindFilters: (ContractKind | 'ALL')[] = ['ALL', 'BUY', 'SELL', 'SHIP', 'LOAN', 'OTHER'];

type SortKey = 'type' | 'location';

// Game columns, in game order. The added cells carry their key in data-rp-col.
const gameColumns = ['contract', 'partner', 'created', 'due', 'status', 'cmds'];
const columns: [key: string, label: string][] = [
  ['contract', 'Contract'],
  ['partner', 'Partner'],
  ['player', 'Player'],
  ['created', 'Created'],
  ['due', 'Due'],
  ['status', 'Status'],
  ['cmds', 'Cmds'],
  ['type', 'Type'],
  ['location', 'Location'],
];

function isAddedCell(cell: Element) {
  return (cell as HTMLElement).dataset.rpCol !== undefined;
}

// Hides the cells of the columns turned off in the COLS picker.
function applyColumns(row: HTMLElement) {
  const hidden = userData.conts.hiddenColumns;
  let gameIndex = 0;
  for (const cell of Array.from(row.children) as HTMLElement[]) {
    const key = cell.dataset.rpCol ?? gameColumns[gameIndex++];
    if (key !== undefined && hidden.includes(key)) {
      cell.dataset.rpHidden = '';
    } else {
      delete cell.dataset.rpHidden;
    }
  }
}

// Keeps the player cell right after the game partner cell when the game renders the row again.
function keepCellAfterPartner(row: HTMLElement, cell: HTMLElement) {
  const place = () => {
    const partner = Array.from(row.children)
      .filter(x => !isAddedCell(x))
      .at(1);
    if (partner && partner.nextElementSibling !== cell) {
      partner.after(cell);
    }
    // Same look as the game partner cell.
    if (partner && cell.className !== partner.className) {
      cell.className = partner.className;
    }
    applyColumns(row);
  };
  place();
  observeDescendantListChanged(row, place);
}

function getRowPartnerCode(row: HTMLElement) {
  return getRowContract(row)?.partner.code ?? undefined;
}

// Contract type from your point of view, read from the contract conditions.
function getContractKind(contract: PrunApi.Contract | undefined): ContractKind | undefined {
  if (!contract) {
    return undefined;
  }
  const types = contract.conditions.map(x => x.type);
  if (types.some(x => x.endsWith('_SHIPMENT'))) {
    return 'SHIP';
  }
  if (types.some(x => x.startsWith('LOAN_'))) {
    return 'LOAN';
  }
  // The party that provides the goods is the seller.
  const goods = contract.conditions.find(
    x => x.type === 'PROVISION' || x.type === 'COMEX_PURCHASE_PICKUP' || x.type === 'DELIVERY',
  );
  if (!goods) {
    return 'OTHER';
  }
  return goods.party === contract.party ? 'SELL' : 'BUY';
}

// Delivery place: the shipment destination, else the place where the goods change hands.
// A shipment pickup (origin) is never the delivery place.
function getContractLocationAddress(contract: PrunApi.Contract | undefined) {
  if (!contract) {
    return undefined;
  }
  for (const condition of contract.conditions) {
    if (condition.destination) {
      return condition.destination;
    }
  }
  for (const condition of contract.conditions) {
    if (condition.address) {
      return condition.address;
    }
  }
  return undefined;
}

function getContractLocation(contract: PrunApi.Contract | undefined) {
  return getEntityNameFromAddress(getContractLocationAddress(contract));
}

// Name and natural ID of the shown delivery place only, so "Hortus", "HRT" or "PD-754d" match.
function getContractLocationSearchText(contract: PrunApi.Contract | undefined) {
  const address = getContractLocationAddress(contract);
  if (!address) {
    return '';
  }
  const name = getEntityNameFromAddress(address) ?? '';
  const naturalId = getEntityNaturalIdFromAddress(address) ?? '';
  return `${name} ${naturalId}`.toLowerCase();
}

function getRowContract(row: HTMLElement) {
  const localId = row.children[0]?.textContent?.trim();
  return contractsStore.getByLocalId(localId);
}

function getRowValue(row: HTMLElement, key: SortKey) {
  const contract = getRowContract(row);
  const value = key === 'type' ? getContractKind(contract) : getContractLocation(contract);
  return value ?? '';
}

// Keeps the added cells at the end of the row, in order, when the game renders it again.
function keepCellsLast(row: HTMLElement, cells: HTMLElement[]) {
  const place = () => {
    const tail = Array.from(row.children).slice(-cells.length);
    if (tail.every((x, i) => x === cells[i])) {
      return;
    }
    for (const cell of cells) {
      row.appendChild(cell);
    }
  };
  place();
  observeDescendantListChanged(row, place);
}

// Deepest element that holds the text, like the partner link inside the cell.
function findTextLeaf(root: HTMLElement): HTMLElement | undefined {
  for (const child of Array.from(root.children) as HTMLElement[]) {
    if ((child.textContent ?? '').trim().length > 0) {
      return findTextLeaf(child) ?? child;
    }
  }
  return undefined;
}

// Player name of the partner. Click the cell to type the name when FIO does not know it.
function createPlayerCell(row: HTMLElement) {
  const cell = document.createElement('td');
  cell.dataset.rpCol = 'player';
  cell.style.cursor = 'pointer';
  let editing = false;

  const render = () => {
    if (editing) {
      return;
    }
    const code = getRowPartnerCode(row);
    const name = code ? getPlayerName(code) : undefined;
    // Copy of the game partner cell content, so the font, color and spacing are the same.
    const partner = Array.from(row.children)
      .filter(x => !isAddedCell(x))
      .at(1);
    const text = name ?? '–';
    const copy = partner?.cloneNode(true) as HTMLElement | undefined;
    const leaf = copy ? findTextLeaf(copy) : undefined;
    if (copy && leaf) {
      for (const x of Array.from(copy.querySelectorAll('[data-tooltip]'))) {
        x.removeAttribute('data-tooltip');
      }
      leaf.textContent = text;
      if (!name) {
        leaf.style.color = '#666';
      }
      cell.replaceChildren(...Array.from(copy.childNodes));
    } else {
      cell.textContent = text;
    }
    // Title, not data-tooltip: the game styles data-tooltip targets as boxes, which breaks the table cell.
    cell.title = name
      ? 'Click to open USR. Shift+click to change the name.'
      : 'Not found in FIO. Click to type the player name.';
  };

  cell.addEventListener('click', e => {
    e.stopPropagation();
    const code = getRowPartnerCode(row);
    if (editing || !code) {
      return;
    }
    const name = getPlayerName(code);
    if (name && !e.shiftKey) {
      void showBuffer(`USR ${name}`);
      return;
    }
    editing = true;
    const input = document.createElement('input');
    input.className = $style.inputText;
    input.style.margin = '0';
    input.style.width = '90px';
    input.value = getPlayerName(code) ?? '';
    cell.replaceChildren(input);
    input.focus();
    let done = false;
    const finish = (save: boolean) => {
      if (done) {
        return;
      }
      done = true;
      editing = false;
      if (save) {
        setPlayerName(code, input.value);
      }
      render();
    };
    input.addEventListener('keydown', ke => {
      ke.stopPropagation();
      if (ke.key === 'Enter') {
        ke.preventDefault();
        finish(true);
      } else if (ke.key === 'Escape') {
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  });

  // Stops when the game removes the row.
  watchEffectWhileNodeAlive(row, render);
  return cell;
}

function onTileReady(tile: PrunTile) {
  let search = '';
  const kindFilter = ref<ContractKind | 'ALL'>('ALL');
  const sortBy = ref<SortKey | undefined>();
  const sortDesc = ref(false);
  let added = false;
  let table: HTMLElement | undefined;
  let tbodyElement: HTMLElement | undefined;
  let headerRowElement: HTMLElement | undefined;
  const showColumnPicker = ref(false);
  const headerCells: Partial<Record<SortKey, HTMLElement>> = {};

  const applyToRow = (row: HTMLElement) => {
    if (matchesRow(row, search) && matchesKind(row, kindFilter.value)) {
      row.classList.remove(css.hidden);
    } else {
      row.classList.add(css.hidden);
    }
  };

  const applyToAll = () => {
    for (const row of Array.from(table?.querySelectorAll('tbody > tr') ?? [])) {
      applyToRow(row as HTMLElement);
    }
  };

  const updateHeaders = () => {
    const labels: Record<SortKey, string> = { type: 'Type', location: 'Location' };
    for (const key of Object.keys(labels) as SortKey[]) {
      const th = headerCells[key];
      if (!th) {
        continue;
      }
      const arrow = sortBy.value !== key ? '' : sortDesc.value ? ' ▼' : ' ▲';
      th.textContent = labels[key] + arrow;
    }
  };

  // Moves the game rows in the sorted order, like the CXM exchange reorder.
  // Without a sort, rows move only when the sort is turned off: new game rows keep their place.
  const sortRows = (restoreGameOrder = false) => {
    const key = sortBy.value;
    if (!tbodyElement || (!key && !restoreGameOrder)) {
      return;
    }
    const tbody = tbodyElement;
    const rows = Array.from(tbody.children).filter(x => x.tagName === 'TR') as HTMLElement[];
    const dir = sortDesc.value ? -1 : 1;
    // The game lists the newest contracts first.
    const createdAt = (row: HTMLElement) => getRowContract(row)?.date.timestamp ?? 0;
    const byGame = (a: HTMLElement, b: HTMLElement) => createdAt(b) - createdAt(a);
    // Equal values keep the game order. Without a sort, the game order comes back.
    const compare = (a: HTMLElement, b: HTMLElement) => {
      if (key) {
        const result = getRowValue(a, key).localeCompare(getRowValue(b, key)) * dir;
        if (result !== 0) {
          return result;
        }
      }
      return byGame(a, b);
    };
    const sorted = rows.slice().sort(compare);
    if (sorted.every((row, i) => row === rows[i])) {
      return;
    }
    for (const row of sorted) {
      tbody.appendChild(row);
    }
  };
  const scheduleSort = oneMicrotask(() => sortRows());

  // Click cycle: ascending -> descending -> game order.
  const onSortClick = (key: SortKey) => {
    if (sortBy.value !== key) {
      sortBy.value = key;
      sortDesc.value = false;
    } else if (!sortDesc.value) {
      sortDesc.value = true;
    } else {
      sortBy.value = undefined;
      sortDesc.value = false;
    }
    updateHeaders();
    sortRows(true);
  };

  const addCells = (row: HTMLElement) => {
    const playerCell = createPlayerCell(row);
    const typeCell = document.createElement('td');
    typeCell.dataset.rpCol = 'type';
    const locationCell = document.createElement('td');
    locationCell.dataset.rpCol = 'location';
    const setText = (cell: HTMLElement, text: string) => {
      if (cell.textContent !== text) {
        cell.textContent = text;
      }
    };
    // Also runs again when a player name arrives from FIO or a contract changes,
    // so the filter result stays correct after the search was typed.
    const update = () => {
      const contract = getRowContract(row);
      setText(typeCell, getContractKind(contract) ?? '');
      setText(locationCell, getContractLocation(contract) ?? '');
      void getPlayerName(getRowPartnerCode(row));
      applyToRow(row);
    };
    keepCellsLast(row, [typeCell, locationCell]);
    keepCellAfterPartner(row, playerCell);
    // Stops when the game removes the row.
    watchEffectWhileNodeAlive(row, update);
    // The game can reuse a row for another contract: check the contract ID text.
    let lastId = row.children[0]?.textContent;
    const observer = new MutationObserver(() => {
      const id = row.children[0]?.textContent;
      if (id !== lastId) {
        lastId = id;
        update();
      }
    });
    observer.observe(row, { childList: true, subtree: true, characterData: true });
  };

  subscribe($$(tile.anchor, 'table'), tableElement => {
    // One search bar per buffer, above the contract table.
    if (added) {
      return;
    }
    added = true;
    table = tableElement;
    const onInput = (e: Event) => {
      search = (e.target as HTMLInputElement).value;
      applyToAll();
    };
    const setKind = (kind: ContractKind | 'ALL') => {
      kindFilter.value = kind;
      applyToAll();
    };

    const toggleColumn = (key: string) => {
      const hidden = userData.conts.hiddenColumns;
      const index = hidden.indexOf(key);
      if (index === -1) {
        hidden.push(key);
      } else {
        hidden.splice(index, 1);
      }
    };

    createFragmentApp(() => (
      <div>
        <div>
          <input
            class={$style.inputText}
            placeholder="Filter by partner, player or base"
            onInput={onInput}
          />
          {kindFilters.map(kind => (
            <PrunButton
              key={kind}
              inline
              dark={kindFilter.value !== kind}
              primary={kindFilter.value === kind}
              onClick={() => setKind(kind)}>
              {kind}
            </PrunButton>
          ))}
          <PrunButton
            inline
            dark={!showColumnPicker.value}
            primary={showColumnPicker.value}
            data-tooltip="Choose the columns to show"
            onClick={() => (showColumnPicker.value = !showColumnPicker.value)}>
            COLS
          </PrunButton>
        </div>
        {showColumnPicker.value && (
          <div>
            {columns.map(([key, label]) => (
              <PrunButton
                key={key}
                inline
                dark={userData.conts.hiddenColumns.includes(key)}
                primary={!userData.conts.hiddenColumns.includes(key)}
                onClick={() => toggleColumn(key)}>
                {label}
              </PrunButton>
            ))}
          </div>
        )}
      </div>
    )).before(tableElement);

    // Shows or hides the columns again when the choice changes.
    watchEffectWhileNodeAlive(tableElement, () => {
      void userData.conts.hiddenColumns.length;
      if (headerRowElement) {
        applyColumns(headerRowElement);
      }
      for (const row of Array.from(tableElement.querySelectorAll('tbody > tr'))) {
        applyColumns(row as HTMLElement);
      }
    });

    subscribe($$(tableElement, 'thead'), thead => {
      subscribe($$(thead, 'tr'), headerRow => {
        const cells: HTMLElement[] = [];
        for (const key of ['type', 'location'] as SortKey[]) {
          const th = document.createElement('th');
          th.dataset.rpCol = key;
          th.style.cursor = 'pointer';
          th.style.userSelect = 'none';
          th.addEventListener('click', () => onSortClick(key));
          headerCells[key] = th;
          cells.push(th);
        }
        updateHeaders();
        keepCellsLast(headerRow, cells);
        const playerTh = document.createElement('th');
        playerTh.dataset.rpCol = 'player';
        playerTh.textContent = 'Player';
        keepCellAfterPartner(headerRow, playerTh);
        headerRowElement = headerRow;
      });
    });

    // Rows are re-rendered when contracts change, so new rows get the cells and filters too.
    subscribe($$(tableElement, 'tbody'), tbody => {
      tbodyElement = tbody;
      subscribe($$(tbody, 'tr'), row => {
        addCells(row);
        applyToRow(row);
        scheduleSort();
      });
    });
  });
}

function matchesRow(row: HTMLElement, search: string) {
  if (!search) {
    return true;
  }
  const query = search.toLowerCase();
  // The contract ID, name and preamble, the partner company, the player and the base name or ID match.
  const contract = row.children[0]?.textContent?.toLowerCase() ?? '';
  const partner = getRowContract(row)?.partner.name.toLowerCase() ?? '';
  const player = getPlayerName(getRowPartnerCode(row))?.toLowerCase() ?? '';
  const location = getContractLocationSearchText(getRowContract(row));
  const contractData = getRowContract(row);
  const title = `${contractData?.name ?? ''} ${contractData?.preamble ?? ''}`.toLowerCase();
  return (
    title.includes(query) ||
    partner.includes(query) ||
    player.includes(query) ||
    contract.includes(query) ||
    location.includes(query)
  );
}

function matchesKind(row: HTMLElement, kind: ContractKind | 'ALL') {
  return kind === 'ALL' || getContractKind(getRowContract(row)) === kind;
}

function init() {
  applyCssRule('CONTS', ['td[data-rp-hidden]', 'th[data-rp-hidden]'], css.hidden);
  tiles.observe('CONTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTS: Adds player, type and location columns, a column picker, and filters by partner, player, location and type.',
);
