import { currentUser } from "@/server/current-user";

import { logOut } from "../auth-actions";

// The logged-in username and a Log out button. Renders nothing when logged
// out. Mounted in the root layout for now; the sidebar will own it later.
export async function LogoutControl() {
  const user = await currentUser();
  if (!user) return null;
  return (
    <form
      action={logOut}
      className="fixed top-3 right-4 z-10 flex items-center gap-2 text-sm"
    >
      <span className="text-gray-600">{user.username}</span>
      <button
        type="submit"
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:border-primary hover:text-primary"
      >
        Log out
      </button>
    </form>
  );
}
