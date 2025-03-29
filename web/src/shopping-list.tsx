import type { ShoppingList } from '@boubouffe/core';
import { For, createResource, onCleanup, onMount } from 'solid-js';

import { Checkbox } from './components/checkbox';

export function ShoppingList(props: { listId: string }) {
  const [list, { onItemChecked }] = useShoppingList(() => props.listId);

  return (
    <ul>
      <For each={list.latest?.items}>
        {(item) => (
          <li>
            <Checkbox
              label={item.product.name}
              checked={item.checked}
              onChange={(checked) => onItemChecked(item.product.id, checked)}
            />
          </li>
        )}
      </For>
    </ul>
  );
}

function useShoppingList(getListId: () => string) {
  const [list, { mutate }] = createResource(getListId, getShoppingList);

  const setItemChecked = (productId: string, checked: boolean) => {
    mutate((prev) => {
      if (!prev) {
        return prev;
      }

      const index = prev?.items.findIndex((item) => item.id === productId);

      if (index < 0) {
        return prev;
      }

      return {
        ...prev,
        items: [
          ...prev.items.slice(0, index),
          { ...prev.items[index], checked },
          ...prev.items.slice(index + 1),
        ],
      };
    });
  };

  const onItemChecked = async (productId: string, checked: boolean) => {
    await checkShoppingListItem(getListId(), productId, checked);
  };

  onMount(() => {
    const eventSource = new EventSource(`/api/shopping-list/${getListId()}/events`);

    eventSource.addEventListener('shoppingListItemUpdated', (event) => {
      const data: { id: string; checked: boolean } = JSON.parse(event.data);

      setItemChecked(data.id, data.checked);
    });

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };

    onCleanup(() => {
      eventSource.close();
    });
  });

  return [list, { onItemChecked }] as const;
}

async function getShoppingList(listId: string) {
  const response = await fetch(`/api/shopping-list/${listId}`);

  if (response.ok) {
    return response.json() as Promise<ShoppingList>;
  }
}

async function checkShoppingListItem(listId: string, productId: string, checked: boolean) {
  await fetch(`/api/shopping-list/${listId}/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked }),
  });
}
