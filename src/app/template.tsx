/**
 * Anders als das Layout wird das Template bei jedem Seitenwechsel neu
 * aufgebaut. Darum lässt sich hier jede neue Seite kurz aufsteigen lassen,
 * statt dass sie hart erscheint.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="seite-rein flex flex-1 flex-col">{children}</div>;
}
