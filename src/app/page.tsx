import { models } from "@/lib/models";

import { Chat } from "./chat";

export default function Home() {
  return <Chat model={models[0]} />;
}
