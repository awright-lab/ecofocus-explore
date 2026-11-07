import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, BookOpen } from "lucide-react";
import type { AnalysisAuthoringPanelProps } from "./AnalysisAuthoringPanel";
import { defaultDataset } from "../builderConstants";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import { filterResearchCatalog, importedResearchCatalog, parseResearchLabels, researchAnswerPreview, sampleResearchCatalog, type ResearchCatalogEntry } from "../../data/researchCatalog";
import "./researchQuestionCatalog.css";

type Props = Pick<AnalysisAuthoringPanelProps, "importedDatasets" | "updateImportedDatasetField" | "openGuidedDataQuery" | "applyQuestionSelection"> & { onClose: () => void };
const PAGE_SIZE = 40;

export function ResearchQuestionCatalog({ importedDatasets, updateImportedDatasetField, openGuidedDataQuery, applyQuestionSelection, onClose }: Props) {
  const modal = useRef<HTMLElement | null>(null);
  useModalAccessibility(modal, onClose);
  const [query, setQuery] = useState("");
  const [studyId, setStudyId] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const entries = useMemo(() => [...importedResearchCatalog(importedDatasets), ...sampleResearchCatalog(defaultDataset.id, `${defaultDataset.label} · sample`, defaultDataset.questions)], [importedDatasets]);
  const topics = useMemo(() => [...new Set(entries.filter(entry => !studyId || entry.studyId === studyId).map(entry => entry.topic))].sort((a,b) => a.localeCompare(b)), [entries, studyId]);
  const results = useMemo(() => filterResearchCatalog(entries, query, studyId, topic), [entries, query, studyId, topic]);
  const lastPage = Math.max(0, Math.ceil(results.length / PAGE_SIZE) - 1), currentPage = Math.min(page, lastPage);
  const visible = results.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = results.find(entry => entry.key === selectedKey) ?? null;
  const remoteStudies = importedDatasets.filter(study => study.remote);

  function launch(entry: ResearchCatalogEntry) {
    if (!entry.available) return;
    // A missing/replaced source must never silently select a different question.
    if (entry.kind === "imported") {
      const study = importedDatasets.find(study => study.id === entry.studyId);
      const field = study?.fields.find(field => field.id === entry.field?.id);
      if (!study || !field) return;
      onClose();
      openGuidedDataQuery({ sourceMode: "imported", outputMode: "table", importedDatasetId: study.id, importedFieldId: field.id, importedFieldSnapshot: field, launchSource: "field" });
    } else if (entry.question) {
      applyQuestionSelection(entry.question);
      onClose();
      openGuidedDataQuery({ sourceMode: "seeded", outputMode: "table", launchSource: "general" });
    }
  }

  return createPortal(<div className="research-catalog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modal} className="research-catalog" role="dialog" aria-modal="true" aria-labelledby="research-catalog-title" aria-describedby="research-catalog-description" tabIndex={-1}>
      <header><div><span className="research-catalog-eyebrow"><BookOpen aria-hidden="true" size={18}/> Research library</span><h2 id="research-catalog-title">Find a research question</h2><p id="research-catalog-description">Search question wording, topics, or concepts. Review the source, then create an analysis.</p></div><button type="button" onClick={onClose} aria-label="Close question catalog"><X aria-hidden="true"/></button></header>
      <div className="research-catalog-filters">
        <label className="research-catalog-search"><span><Search aria-hidden="true" size={16}/> Search questions</span><input autoComplete="off" placeholder="e.g. packaging trust or brand priorities" value={query} onChange={event => { setQuery(event.target.value); setPage(0); setSelectedKey(null); }}/></label>
        <label>Study<select value={studyId} onChange={event => { setStudyId(event.target.value); setTopic(""); setPage(0); setSelectedKey(null); }}><option value="">All available studies</option>{studyId && studyId !== defaultDataset.id && !importedDatasets.some(study => study.id === studyId) && <option value={studyId} disabled>Unavailable study</option>}{importedDatasets.map(study => <option key={study.id} value={study.id}>{study.title} · {study.remote ? "remote metadata" : "imported"}</option>)}<option value={defaultDataset.id}>{defaultDataset.label} · sample</option></select></label>
        <label>Topic<select value={topic} onChange={event => { setTopic(event.target.value); setPage(0); setSelectedKey(null); }}><option value="">All topics</option>{topic && !topics.includes(topic) && <option value={topic} disabled>Unavailable topic: {topic}</option>}{topics.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      {remoteStudies.length > 0 && <p className="research-catalog-notice">Remote studies show only metadata already available in this browser, which may be incomplete. Use Browse fields in the study library to search server-backed fields. Topic and concept editing is available for local studies only.</p>}
      <div className="research-catalog-body">
        <div className="research-catalog-results"><p role="status">{results.length.toLocaleString()} {results.length === 1 ? "question" : "questions"} found{results.length > PAGE_SIZE ? ` · showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, results.length)}` : ""}</p>
          {!results.length && <div className="research-catalog-empty"><h3>No matching questions</h3><p>Try another wording, clear the topic, or choose another study. Concepts are declared labels, not AI-generated matches.</p><button type="button" onClick={() => { setQuery(""); setTopic(""); setPage(0); }}>Clear search and topic</button></div>}
          <ul aria-label="Research questions">{visible.map(entry => <li key={entry.key}><button type="button" className={entry.key === selectedKey ? "selected" : ""} aria-pressed={entry.key === selectedKey} onClick={() => setSelectedKey(entry.key)}><small>{entry.studyTitle} · {entry.kind === "sample" ? "Sample data" : "Imported study"}</small><strong>{entry.wording}</strong><span>{entry.topic}{entry.concepts.length ? ` · ${entry.concepts.join(" · ")}` : ""}</span><small>{entry.code} · {entry.available ? "Review question" : "Reference field · modeling needed"}</small></button></li>)}</ul>
          {lastPage > 0 && <nav aria-label="Question results pages"><button type="button" disabled={!currentPage} onClick={() => { setPage(currentPage - 1); setSelectedKey(null); }}>Previous questions</button><span>Page {currentPage + 1} of {lastPage + 1}</span><button type="button" disabled={currentPage === lastPage} onClick={() => { setPage(currentPage + 1); setSelectedKey(null); }}>Next questions</button></nav>}
        </div>
        <aside className="research-catalog-detail" aria-label="Question details">{selected ? <>
          <span className="research-catalog-eyebrow">{selected.kind === "sample" ? "Sample question" : "Imported question"}</span><h3>{selected.wording}</h3><p>{selected.studyTitle}</p><dl><dt>Source field</dt><dd>{selected.code}</dd><dt>Topic</dt><dd>{selected.topic}</dd><dt>Concepts</dt><dd>{selected.concepts.join(", ") || "No concepts declared"}</dd></dl>
          {!!researchAnswerPreview(selected).length && <><h4>Answer preview</h4><ul>{researchAnswerPreview(selected).map((label,index) => <li key={index}>{label}</li>)}</ul><small>Up to eight answer labels. Full results are reviewed in Create analysis.</small></>}
          <button type="button" className="research-catalog-create" disabled={!selected.available} onClick={() => launch(selected)}>Create analysis from this question</button>
          {!selected.available && <p>This reference field needs modeling before it can drive an analysis. Existing field settings remain available in the study library.</p>}
          {selected.field && !importedDatasets.find(study => study.id === selected.studyId)?.remote && <ResearchLabelsEditor key={selected.key} entry={selected} onSave={updates => {
            const saved = updateImportedDatasetField(selected.studyId, selected.field!.id, updates);
            if (topic === selected.topic && updates.researchTopic !== selected.topic) setTopic(updates.researchTopic || "Uncategorized");
            return saved;
          }}/>}
        </> : <div className="research-catalog-empty"><BookOpen aria-hidden="true" size={30}/><h3>Start with the question</h3><p>Select a question to see its wording, source, topic and answer labels. Your study data stays unchanged.</p></div>}</aside>
      </div>
    </section>
  </div>, document.body);
}

function ResearchLabelsEditor({ entry, onSave }: { entry: ResearchCatalogEntry; onSave: (updates: ReturnType<typeof parseResearchLabels>) => boolean | void }) {
  const [topic, setTopic] = useState(entry.field?.researchTopic ?? "");
  const [concepts, setConcepts] = useState(entry.concepts.join(", "));
  const [message, setMessage] = useState("");
  return <form className="research-catalog-labels" onSubmit={event => {
    event.preventDefault();
    try {
      const saved = onSave(parseResearchLabels(topic, concepts));
      setMessage(saved === false ? "Labels remain in memory, but the workspace could not be saved. Close this dialog to use workspace recovery and retry saving." : saved === true ? "Discovery labels saved in this browser." : "Labels applied in this browser workspace. Check workspace save status for persistence.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Labels could not be applied."); }
  }}><h4>Organize this question</h4><p>Declare labels for discovery. This changes no answers, values, or analysis settings.</p><label>Question topic<input value={topic} maxLength={120} onChange={event => { setTopic(event.target.value); setMessage(""); }}/></label><label>Question concepts<input value={concepts} maxLength={1640} placeholder="e.g. confidence, purchase intent" onChange={event => { setConcepts(event.target.value); setMessage(""); }}/></label><small>Separate concepts with commas; up to 20 labels of 80 characters.</small><button type="submit">Apply discovery labels</button><p role="status">{message}</p></form>;
}
