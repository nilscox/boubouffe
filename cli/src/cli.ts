import 'dotenv/config';

import fs from 'node:fs/promises';

import { Dish, Product, ProductStock, Recipe, ShoppingList, Unit } from '@bectance/shared/dtos';
import { toObject } from '@bectance/shared/utils';
import { Command, InvalidArgumentError } from 'commander';
import { Table } from 'console-table-printer';
import frontMatter from 'front-matter';

import { api } from './api';

const product = new Command('product');

product
  .command('list')
  .description('Print a list of all products')
  .action(async () => {
    const products = await api<Product[]>('GET', '/product');

    printTable(
      ['Name', 'Unit'],
      products.map((product) => [product.name, product.unit]),
    );
  });

product
  .command('create')
  .description('Create a new product')
  .requiredOption('--name <name>', 'Name of the product')
  .requiredOption('--unit <unit>', 'Unit of the product', parseUnit)
  .requiredOption('--default-quantity <quantity>', 'Default quantity of the product', parsePositiveInteger)
  .action(async ({ name, unit, defaultQuantity }) => {
    await api('POST', '/product', { body: { name, unit, defaultQuantity } });
  });

product
  .command('import')
  .description('Import a list of products')
  .argument('<json>', 'Products list to import')
  .action(async (json) => {
    for (const product of JSON.parse(json)) {
      console.debug('Importing', product);
      await api('POST', '/product', { body: product });
    }
  });

product
  .command('update')
  .description('Update an existing product')
  .argument('<name>', 'Name of the product', parseProductName)
  .option('--name <name>', 'Name of the product')
  .option('--unit <unit>', 'Unit of the product', parseUnit)
  .action(async (productId, options) => {
    await api('PUT', `/product/${productId}`, { body: options });
  });

const stock = new Command('stock');

stock
  .command('get')
  .description('Print the current stock')
  .action(async () => {
    const stocks = await api<ProductStock[]>('GET', '/stock');

    printTable(
      ['Product', 'Qty'],
      stocks.map((product) => [product.name, formatUnit(product.quantity, product.unit)]),
    );
  });

stock
  .command('update')
  .description('Update the current stock')
  .argument('<product>', 'Name of the product', parseProductName)
  .argument('<quantity>', 'Quantity to set', parsePositiveInteger)
  .action(async (productId, quantity) => {
    await api('PUT', `/stock/${productId}`, {
      body: { quantity },
    });
  });

const list = new Command('list');

list
  .command('get')
  .description('Print a shopping list')
  .argument('<name>', 'Name of the shopping list', parseShoppingListName)
  .action(async (listId) => {
    const list = await api<ShoppingList>('GET', `/shopping-list/${listId}`);

    printTable(
      ['Product', 'Qty', 'Checked'],
      list.items.map((item) => [
        item.label,
        item.quantity ? formatUnit(item.quantity, item.unit) : '',
        item.checked ? 'x' : '',
      ]),
    );
  });

list
  .command('create')
  .description('Create a new shopping list')
  .requiredOption('--name <name>', 'Name of the shopping list')
  .action(async ({ name }) => {
    await api('POST', '/shopping-list', {
      body: { name },
    });
  });

list
  .command('item')
  .description('Create or update an item from a shopping list')
  .argument('<list>', 'Name of the shopping list', parseShoppingListName)
  .argument('<product>', 'Name of the product', parseProductName)
  .option('--quantity <value>', 'Set the quantity', parsePositiveInteger)
  .option('--no-quantity', 'Remove the quantity')
  .option('--checked', 'Mark the product as checked')
  .option('--no-checked', 'Mark the product as not checked')
  .action(async (listId, productId, options) => {
    await api('PUT', `/shopping-list/${listId}/${productId}`, {
      body: options,
    });
  });

const recipe = new Command('recipe');

recipe
  .command('list')
  .description('Print a list of all recipes')
  .action(async () => {
    const recipes = await api<Recipe[]>('GET', `/recipe`);

    printTable(
      ['ID', 'Name'],
      recipes.map(({ id, name }) => [id, name]),
    );
  });

recipe
  .command('create')
  .description('Create a new recipe')
  .requiredOption('--name <name>', 'Name of the recipe')
  .requiredOption('--description <description>', 'Description of the recipe')
  .action(async ({ name, description }) => {
    await api('POST', '/recipe', {
      body: { name, description },
    });
  });

recipe
  .command('ingredient')
  .description('Add an ingredient to a recipe')
  .argument('<name>', 'Name of the recipe', parseRecipeName)
  .argument('<product>', 'Name of the product', parseProductName)
  .requiredOption('--quantity <quantity>', 'Quantity of ingredient', parsePositiveInteger)
  .action(async (recipeId, productId, { quantity }) => {
    await api('PUT', `/recipe/${recipeId}`, {
      body: { productId, quantity },
    });
  });

recipe
  .command('import')
  .description('Import a recipe')
  .argument('<path>', 'Markdown file')
  .action(async (path) => {
    const products = await api<Product[]>('GET', '/product');
    const file = (await fs.readFile(path)).toString('utf-8');

    const { attributes, body } = frontMatter<{
      name: string;
      time: string;
      tags: string;
      link: string;
      ingredients: Array<{ label: string; quantity: number; unit?: string }>;
    }>(file);

    const { id } = await api<{ id: string }>('POST', '/recipe', {
      body: {
        name: attributes.name,
        description: body,
      },
    });

    for (const ingredient of attributes.ingredients) {
      const product = products.find(
        (product) => product.name === ingredient.label || product.namePlural === ingredient.label,
      );

      await api('PUT', `/recipe/${id}`, {
        body: {
          productId: product?.id,
          label: ingredient.unit ? ingredient.label : undefined,
          unit: ingredient.unit,
          quantity: ingredient.quantity,
        },
      });
    }
  });

const dish = new Command('dish');

dish
  .command('list')
  .description('List all dishes')
  .action(async () => {
    const dishes = await api<Dish[]>('GET', `/dish`);

    printTable(
      ['ID', 'name', 'date'],
      dishes.map(({ id, name, date }) => [id, name, date]),
    );
  });

dish
  .command('create')
  .description('Create a new dish (an instance of a recipe)')
  .requiredOption('--recipeId <id>', 'Identifier of the recipe')
  .action(async ({ recipeId }) => {
    await api<Dish>('POST', '/dish', { body: { recipeId } });
  });

const program = new Command();

program.addCommand(product);
program.addCommand(stock);
program.addCommand(list);
program.addCommand(recipe);
program.addCommand(dish);

program.hook('preAction', async function (_, action) {
  action.processedArgs = await Promise.all(action.processedArgs);
});

program.parse();

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError('Must be a valid number.');
  }

  if (!Number.isInteger(parsed)) {
    throw new InvalidArgumentError('Must be an integer.');
  }

  if (parsed < 0) {
    throw new InvalidArgumentError('Must be a positive.');
  }

  return parsed;
}

function parseUnit(value: string) {
  const units: Unit[] = ['unit', 'gram', 'liter'];

  if (!units.includes(value as Unit)) {
    throw new InvalidArgumentError('Not a valid unit.');
  }

  return value;
}

async function parseShoppingListName(name: string) {
  const [list] = await api<{ id: string }[]>('GET', '/shopping-list', {
    query: { name },
  });

  if (!list) {
    throw new InvalidArgumentError('Cannot find shopping list');
  }

  return list.id;
}

async function parseProductName(name: string) {
  const [product] = await api<{ id: string }[]>('GET', '/product', {
    query: { name },
  });

  if (!product) {
    throw new InvalidArgumentError('Cannot find product');
  }

  return product.id;
}

async function parseRecipeName(name: string) {
  const [recipe] = await api<{ id: string }[]>('GET', '/recipe', {
    query: { name },
  });

  if (!recipe) {
    throw new InvalidArgumentError('Cannot find recipe');
  }

  return recipe.id;
}

export function formatUnit(quantity: number, unit?: Unit) {
  if (!unit) {
    return '';
  }

  if (unit === 'unit') {
    return `${quantity}`;
  }

  if (unit === 'gram') {
    return `${quantity}g`;
  }

  if (unit === 'liter') {
    return `${quantity}L`;
  }

  throw new Error('Unknown unit');
}

export function printTable(columns: string[], values: string[][]) {
  if (values.length === 0) {
    console.log('No data.');
    return;
  }

  const table = new Table({
    columns: columns.map((name) => ({ name })),
  });

  values.forEach((row) =>
    table.addRow(
      toObject(
        columns,
        (key) => key,
        (_, index) => row[index],
      ),
    ),
  );

  table.printTable();
}
