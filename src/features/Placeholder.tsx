import { Empty, Header } from '../components/ui';

/** Übergangsseite, bis die jeweilige Funktion gebaut ist */
export function Soon({ title, emoji, text, back }: { title: string; emoji: string; text: string; back?: boolean }) {
  return (
    <div className={back ? 'page no-tabbar' : 'page'}>
      <Header title={title} back={back} />
      <Empty emoji={emoji} title="Kommt als Nächstes">{text}</Empty>
    </div>
  );
}
