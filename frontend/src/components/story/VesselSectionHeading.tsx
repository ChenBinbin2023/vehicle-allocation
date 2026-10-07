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
  return (
    <header className="vessel-section-heading">
      <span className="vessel-section-number" aria-hidden="true">
        {number}
      </span>
      <div>
        <small>{english}</small>
        <h2 id={headingId}>{title}</h2>
        <p>{note}</p>
      </div>
    </header>
  );
}
