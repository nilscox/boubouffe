import { and, asc, eq, sql } from 'drizzle-orm';

import { NotFoundError } from '../../errors.js';
import { emitDomainEvent } from '../../events.js';
import { db } from '../../persistence/database.js';
import { shoppingList, shoppingListItems } from '../../persistence/schema.js';
import { defined } from '../../utils.js';
import { findProduct } from '../product/product.domain.js';

export async function listShoppingLists(filters?: { name?: string }) {
  let where = and();

  if (filters?.name !== undefined) {
    where = and(where, eq(shoppingList.name, filters.name));
  }

  return db.query.shoppingList.findMany({
    where,
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });
}

export async function getShoppingList(listId: string) {
  const list = await db.query.shoppingList.findFirst({
    where: eq(shoppingList.id, listId),
    with: {
      items: {
        with: {
          product: true,
        },
        orderBy: asc(shoppingListItems.position),
      },
    },
  });

  return defined(list, new NotFoundError('Cannot find shopping list', { id: listId }));
}

export async function createShoppingList(shoppingListId: string, shoppingListName: string) {
  await db.insert(shoppingList).values({
    id: shoppingListId,
    name: shoppingListName,
  });
}

export async function createShoppingListItem(
  listId: string,
  itemId: string,
  param: { productId: string } | { label: string },
  options: Partial<{ quantity: number; checked: boolean }>,
) {
  const productId = 'productId' in param ? param.productId : undefined;
  const label = 'label' in param ? param.label : undefined;

  const product = productId ? await findProduct(productId) : undefined;

  const count = await db.$count(shoppingListItems, eq(shoppingListItems.shoppingListId, listId));

  const values: typeof shoppingListItems.$inferInsert = {
    id: itemId,
    shoppingListId: listId,
    productId,
    label,
    quantity: options.quantity || product?.defaultQuantity,
    checked: options.checked ?? false,
    position: count,
  };

  await db.insert(shoppingListItems).values(values);

  emitDomainEvent('shoppingListItemCreated', {
    id: itemId,
    shoppingListId: listId,
    label: (product?.name ?? label) as string,
    quantity: options.quantity || product?.defaultQuantity,
    checked: options.checked ?? false,
    unit: product?.unit,
  });
}

export async function updateShoppingListItem(
  itemId: string,
  options: Partial<{ quantity: number; checked: boolean }>,
) {
  if (Object.keys(options).length === 0) {
    return;
  }

  const getQuantity = () => {
    if (options.quantity !== undefined) {
      return options.quantity;
    }
  };

  const getChecked = () => {
    if (options.checked !== undefined) {
      return options.checked;
    }
  };

  const values = {
    quantity: getQuantity(),
    checked: getChecked(),
  };

  await db.update(shoppingListItems).set(values).where(eq(shoppingListItems.id, itemId));

  emitDomainEvent('shoppingListItemUpdated', {
    id: itemId,
    ...options,
  });
}

export async function deleteShoppingListItem(shoppingListId: string, itemId: string) {
  await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
  await db.execute(sql`CALL reconcile_shopping_list_item_position(${shoppingListId})`);

  emitDomainEvent('shoppingListItemDeleted', { id: itemId });
}
