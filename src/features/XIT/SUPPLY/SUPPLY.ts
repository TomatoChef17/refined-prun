import SUPPLY from '@src/features/XIT/SUPPLY/SUPPLY.vue';

xit.add({
  command: 'SUPPLY',
  name: 'SUPPLY',
  description:
    'Inputs needed by all bases compared with your home station warehouse stock (XIT SET COSM).',
  component: () => SUPPLY,
});
