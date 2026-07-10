"use client";

import { useState, useEffect } from "react";
import type { Question } from "@/lib/quiz-api";

type QuestionInput = {
  id?: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
};

export default function QuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<QuestionInput | null>(null);
  const [formData, setFormData] = useState<QuestionInput>({
    question: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "A",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false });
      setQuestions((data ?? []) as Question[]);
    } catch (e) {
      console.error("Error loading questions:", e);
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      question: "",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "A",
    });
    setEditing(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { supabase } = await import("@/lib/supabase");

      if (editing?.id) {
        // Update existing
        const { error } = await supabase
          .from("questions")
          .update({
            question: formData.question,
            option_a: formData.option_a,
            option_b: formData.option_b,
            option_c: formData.option_c,
            option_d: formData.option_d,
            correct_option: formData.correct_option,
          })
          .eq("id", editing.id);

        if (error) throw error;
        setMessage({ type: "success", text: "Question updated!" });
      } else {
        // Create new
        const { error } = await supabase.from("questions").insert({
          question: formData.question,
          option_a: formData.option_a,
          option_b: formData.option_b,
          option_c: formData.option_c,
          option_d: formData.option_d,
          correct_option: formData.correct_option,
        });

        if (error) throw error;
        setMessage({ type: "success", text: "Question added!" });
      }

      resetForm();
      loadQuestions();
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Something went wrong",
      });
    }
    setSaving(false);
  }

  function handleEdit(q: Question) {
    setFormData({
      id: q.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
    });
    setEditing(q);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;

    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
      loadQuestions();
      setMessage({ type: "success", text: "Question deleted!" });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Could not delete",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📝 QR Quiz Questions</h2>
          <p className="text-sm text-slate-500">
            {questions.length} questions • Each correct = {0.5} points
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          + Add Question
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-6 border-2 border-indigo-200">
          <h3 className="font-semibold mb-4">
            {editing ? "✏️ Edit Question" : "➕ Add New Question"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Question</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="Enter the question..."
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {["A", "B", "C", "D"].map((opt) => (
                <div key={opt}>
                  <label className="block text-sm font-medium mb-1">
                    Option {opt}
                  </label>
                  <input
                    className="input"
                    placeholder={`Answer ${opt}`}
                    value={formData[`option_${opt.toLowerCase()}` as keyof QuestionInput]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [`option_${opt.toLowerCase()}`]: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Correct Answer
              </label>
              <div className="flex gap-4">
                {["A", "B", "C", "D"].map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border ${
                      formData.correct_option === opt
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="correct"
                      value={opt}
                      checked={formData.correct_option === opt}
                      onChange={(e) =>
                        setFormData({ ...formData, correct_option: e.target.value })
                      }
                      className="sr-only"
                    />
                    Option {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : editing ? "Update Question" : "Add Question"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          No questions yet. Add some to get started!
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="card p-4">
              <div className="flex items-start gap-4">
                <span className="text-sm font-bold text-slate-400">
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{q.question}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {["A", "B", "C", "D"].map((opt) => (
                      <div
                        key={opt}
                        className={`px-2 py-1 rounded ${
                          q.correct_option === opt
                            ? "bg-emerald-100 text-emerald-700 font-medium"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {opt}. {q[`option_${opt.toLowerCase()}` as keyof typeof q]}
                        {q.correct_option === opt && " ✓"}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(q)}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Sample Questions */}
      {questions.length === 0 && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            💡 <strong>Tip:</strong> Run this SQL in Supabase SQL Editor to add sample
            questions:
          </p>
          <pre className="mt-2 p-3 bg-white rounded text-xs overflow-x-auto">
{`INSERT INTO public.questions (question, option_a, option_b, option_c, option_d, correct_option) VALUES
('What year was this event first held?', '2020', '2021', '2022', '2023', 'B'),
('How many stations are there in total?', '3', '5', '7', '10', 'C'),
('What is the maximum points per station?', '5', '10', '15', '20', 'B'),
('Which color was NOT used in our branding?', 'Red', 'Green', 'Blue', 'Yellow', 'B'),
('How long do you have for the QR quiz?', '10 seconds', '20 seconds', '30 seconds', '60 seconds', 'B');`}
          </pre>
        </div>
      )}
    </div>
  );
}
