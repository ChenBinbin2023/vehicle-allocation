import { useI18n } from "@/lib/i18n/LocaleProvider";
export default function VesselSectionHeading({
  number,
  english,
  title,
  note,
  headingId,
}: {
  number: string;
  english: string;
  title: string;
  note: string;
  headingId?: string;
}) {
  const { t: translateText } = useI18n();

  return (
    <header className="vessel-section-heading">
      <span className="vessel-section-number" aria-hidden="true">
        {translateText(number)}
      </span>
      <div>
        <small>{translateText(english)}</small>
        <h2 id={headingId}>{translateText(title)}</h2>
        <p>{translateText(note)}</p>
      </div>
    </header>
  );
}
