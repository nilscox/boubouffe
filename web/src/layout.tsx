import { A, useMatch } from '@solidjs/router';
import { CookingPotIcon, HouseIcon, ShoppingCartIcon } from 'lucide-solid';
import { JSX, Show } from 'solid-js';

import * as shoppingList from './shopping-list';
import * as shoppingListList from './shopping-lists';

export function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="h-screen col overflow-hidden">
      <Header />
      <main class="p-4 col flex-1 overflow-auto">{props.children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <>
      <Route path="/list" component={shoppingListList.Header} />
      <Route path="/list/:listId" component={shoppingList.Header} />
    </>
  );
}

function Route(props: { path: string; component: () => JSX.Element }) {
  const match = useMatch(() => props.path);

  return (
    <Show when={match()}>
      <props.component />
    </Show>
  );
}

function Footer() {
  return (
    <footer class="row justify-evenly border-t">
      <NavLink href="/recipe">
        <CookingPotIcon class="size-6" />
      </NavLink>

      <NavLink href="/list">
        <ShoppingCartIcon class="size-6" />
      </NavLink>

      <NavLink href="/stock">
        <HouseIcon class="size-6" />
      </NavLink>
    </footer>
  );
}

function NavLink(props: { href: string; children: JSX.Element }) {
  return (
    <A
      class="size-12 flex items-center justify-center"
      activeClass="text-zinc-800"
      inactiveClass="text-zinc-400"
      {...props}
    />
  );
}
