import { Combobox as ArkCombobox, createListCollection } from '@ark-ui/solid';
import type { DomainEvents, Product, ShoppingList, ShoppingListItem } from '@bectance/shared/dtos';
import { assert, hasProperty } from '@bectance/shared/utils';
import { useParams } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { Trash2Icon, XIcon } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { produce } from 'solid-js/store';
import { Dynamic } from 'solid-js/web';

import { deleteShoppingListItem, getShoppingList, listProducts, upsertShoppingListItem } from './api';
import { Checkbox } from './components/checkbox';
import { Combobox } from './components/combobox';
import { Spinner } from './components/spinner';
import { useLongPress } from './utils/long-press';

export function ShoppingList() {
  const productList = useProductList();

  const params = useParams<{ listId: string }>();
  const query = createQuery(() => ({
    queryKey: ['getList', params.listId],
    queryFn: () => getShoppingList(params.listId),
  }));

  useShoppingListEventSource(() => params.listId);

  const [showActions, setShowActions] = createSignal<ShoppingListItem>();

  const elements = new Map<ShoppingListItem, HTMLElement>();

  const onHighlight = (item: ShoppingListItem) => {
    const element = elements.get(item);

    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    element?.classList.add('bg-amber-100');
    setTimeout(() => element?.classList.remove('bg-amber-100'), 1000);
  };

  const total = () => {
    return query.data?.items.length;
  };

  const checked = () => {
    return query.data?.items.filter((item) => item.checked).length;
  };

  return (
    <div class="col gap-6 mb-6">
      <div class="text-3xl">{query.data?.name}</div>

      <section>
        <header class="row justify-between items-center mb-2">
          <h2 class="text-xl font-bold text-dim">Plats</h2>
        </header>

        <ul class="list-disc list-inside">
          <li>Curry de légumes</li>
          <li>Tarte aux oignons</li>
          <li>Soupe de butternut et potimarron</li>
          <li>Salade</li>
        </ul>
      </section>

      <section>
        <header class="row justify-between items-center mb-2">
          <h2 class="text-xl font-bold text-dim">Produits</h2>

          <div class="text-sm text-dim">
            {checked()}/{total()}
          </div>
        </header>

        <ul>
          <For each={query.data?.items}>
            {(item) => (
              <ShoppingListItem
                ref={(ref) => void elements.set(item, ref)}
                listId={params.listId}
                item={item}
                showActions={showActions() === item}
                onShowActions={(show: boolean) => setShowActions(show ? item : undefined)}
              />
            )}
          </For>

          <li class="row gap-4 items-center py-0.5 px-1 rounded">
            <Checkbox
              label={
                <AddItemCombobox
                  list={query.data}
                  products={productList.data ?? []}
                  onHighlight={onHighlight}
                />
              }
              readOnly
              class="w-full"
              classes={{ label: 'grow' }}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function AddItemCombobox(props: {
  list?: ShoppingList;
  products: Product[];
  onHighlight: (item: ShoppingListItem) => void;
}) {
  const [products, setProducts] = createSignal(props.products);
  const [value, setValue] = createSignal<string[]>([]);

  createEffect(() => {
    setProducts(props.products);
  });

  const collection = createMemo(() =>
    createListCollection({
      items: products().map((product) => ({
        item: product,
        label: product.name,
        value: product.id,
      })),
    }),
  );

  let inputRef!: HTMLInputElement;

  const addItem = createMutation(() => ({
    mutationFn: async ({ productId }: { productId: string }) => {
      const item = props.list?.items.find((item) => item.product.id === productId);

      if (item) {
        props.onHighlight(item);
      } else if (props.list) {
        await upsertShoppingListItem(props.list?.id, productId);
      }
    },
    onSuccess() {
      setProducts(props.products);
      setValue([]);

      setTimeout(() => {
        inputRef.scrollIntoView({ block: 'center' });
        inputRef.focus();
      }, 0);
    },
  }));

  return (
    <ArkCombobox.Root
      collection={collection()}
      onInputValueChange={({ inputValue }) => {
        setProducts(props.products.filter((product) => product.name.includes(inputValue)));
      }}
      value={value()}
      onValueChange={({ items, value }) => {
        setValue(value);

        if (items[0]) {
          addItem.mutate({ productId: items[0].value });
        }
      }}
    >
      <ArkCombobox.Control class="row items-center">
        <ArkCombobox.Input
          ref={inputRef}
          disabled={addItem.isPending}
          placeholder="Ajouter un produit"
          class="outline-none w-full"
        />
      </ArkCombobox.Control>

      <Combobox.Dropdown items={collection().items} class="max-h-72" />
    </ArkCombobox.Root>
  );
}

function ShoppingListItem(props: {
  ref: (ref: HTMLLIElement) => void;
  listId: string;
  item: ShoppingListItem;
  showActions: boolean;
  onShowActions: (show: boolean) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const longPress = useLongPress(200);

  const checkItem = createMutation(() => ({
    mutationFn: async ({ checked }: { checked: boolean }) => {
      await upsertShoppingListItem(props.listId, props.item.product.id, { checked });
    },
  }));

  const deleteItem = createMutation(() => ({
    mutationFn: async () => {
      await deleteShoppingListItem(props.listId, props.item.id);
    },
  }));

  return (
    <li
      ref={props.ref}
      use:longPress={() => props.onShowActions(!props.showActions)}
      class="row gap-4 items-center py-0.5 px-1 rounded"
      classList={{ 'bg-zinc-100': props.showActions }}
    >
      <Checkbox
        label={
          <>
            {props.item.product.name}
            {checkItem.isPending && <Spinner class="size-em ms-2 py-px" />}
          </>
        }
        disabled={checkItem.isPending}
        checked={props.item.checked}
        onChange={(checked) => checkItem.mutate({ checked })}
        class="w-full"
      />

      <Show when={props.showActions}>
        <div class="row gap-2 items-center">
          <button type="button" disabled={deleteItem.isPending} onClick={() => deleteItem.mutate()}>
            <Dynamic component={!deleteItem.isPending ? Trash2Icon : Spinner} class="size-4" />
          </button>

          <button type="button" onClick={() => props.onShowActions(false)}>
            <XIcon class="size-4" />
          </button>
        </div>
      </Show>
    </li>
  );
}

function useProductList() {
  return createQuery(() => ({
    queryKey: ['listProducts'],
    queryFn: () => listProducts(),
  }));
}

function useUpdateList() {
  const queryClient = useQueryClient();

  return (listId: string, updater: (list: ShoppingList) => void) => {
    queryClient.setQueryData(['getList', listId], (list: ShoppingList | undefined) => {
      if (list) {
        return produce(updater)(list);
      }
    });
  };
}

function useUpdateListItem() {
  const updateList = useUpdateList();

  return (listId: string, productId: string, updater: (item: ShoppingListItem) => void) => {
    updateList(listId, (list) => {
      const item = list.items.find((item) => item.id === productId);

      assert(item);
      updater(item);
    });
  };
}

function useShoppingListEventSource(getListId: () => string) {
  const productList = useProductList();

  const updateList = useUpdateList();
  const updateItem = useUpdateListItem();

  onMount(() => {
    const eventSource = new EventSource(`/api/shopping-list/${getListId()}/events`);

    eventSource.addEventListener('shoppingListItemUpdated', (event) => {
      const { id, ...data }: DomainEvents['shoppingListItemUpdated'] = JSON.parse(event.data);

      updateItem(getListId(), id, (item) => {
        Object.assign(item, data);
      });
    });

    eventSource.addEventListener('shoppingListItemCreated', (event) => {
      const data: DomainEvents['shoppingListItemCreated'] = JSON.parse(event.data);
      const product = productList.data?.find(hasProperty('id', data.productId));

      if (!product) {
        return;
      }

      updateList(getListId(), (list) => {
        list.items.push({
          id: data.id,
          product,
          checked: data.checked,
          quantity: data.quantity,
        });
      });
    });

    eventSource.addEventListener('shoppingListItemDeleted', (event) => {
      const data: DomainEvents['shoppingListItemDeleted'] = JSON.parse(event.data);

      updateList(getListId(), (list) => {
        const index = list.items.findIndex(hasProperty('id', data.id));

        if (index >= 0) {
          list.items = [...list.items.slice(0, index), ...list.items.slice(index + 1)];
        }
      });
    });

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };

    onCleanup(() => {
      eventSource.close();
    });
  });
}
