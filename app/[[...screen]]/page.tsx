import { Stockroom } from "../../components/stockroom";

export function generateStaticParams() {
  return [[], ["godowns"], ["stock"], ["sales"], ["purchases"], ["reports"]].map((screen) => ({ screen }));
}

export default function Page() {
  return <Stockroom />;
}
