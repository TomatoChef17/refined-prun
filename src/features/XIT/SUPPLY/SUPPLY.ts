import SUPPLY from '@src/features/XIT/SUPPLY/SUPPLY.vue';

xit.add({
  command: 'SUPPLY',
  name: 'SUPPLY',
  description:
    'Inputs needed by all bases compared with Hortus Station stock: what is missing at HRT.',
  component: () => SUPPLY,
});
