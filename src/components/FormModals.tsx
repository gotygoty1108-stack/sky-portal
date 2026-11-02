"use client";

import { Edit, FileText, PlusCircle, Save } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { todayInput } from "@/lib/format";
import { CUSTOMER_STATUSES, type Customer, type CustomerFields } from "@/lib/types";
import { Button, Field, inputClass, Modal } from "./ui";

const EMPTY_CUSTOMER: CustomerFields = { name: "", kana: "", contactPerson: "", email: "", phone: "", address: "", status: "提案中", team: "" };

function useSubmit<T>(onSave: (data: T) => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const submit = async (data: T) => {
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };
  return { saving, submit };
}

export function CustomerFormModal({
  initialData,
  isAdmin,
  teams,
  onClose,
  onSave,
}: {
  initialData: Customer | null;
  isAdmin: boolean;
  teams: string[];
  onClose: () => void;
  onSave: (data: CustomerFields & { id?: string }) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CustomerFields>(() =>
    initialData
      ? {
          name: initialData.name,
          kana: initialData.kana,
          contactPerson: initialData.contactPerson,
          email: initialData.email,
          phone: initialData.phone,
          address: initialData.address,
          status: initialData.status || EMPTY_CUSTOMER.status,
          team: initialData.team,
        }
      : EMPTY_CUSTOMER,
  );
  const { saving, submit } = useSubmit(onSave);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit({ ...formData, id: initialData?.id });
  };

  return (
    <Modal
      title={initialData ? "顧客情報の編集" : "新規顧客登録"}
      icon={initialData ? Edit : PlusCircle}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button type="submit" form="customer-form" loading={saving} icon={Save}>
            {initialData ? "更新する" : "登録する"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="企業名" required>
          <input required name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="例: 株式会社サンプル" />
        </Field>
        <Field label="フリガナ">
          <input name="kana" value={formData.kana} onChange={handleChange} className={inputClass} placeholder="例: カブシキガイシャサンプル" />
        </Field>
        <Field label="担当者名" required>
          <input required name="contactPerson" value={formData.contactPerson} onChange={handleChange} className={inputClass} placeholder="例: 山田 太郎" />
        </Field>
        <Field label="ステータス">
          <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="電話番号">
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="例: 03-1234-5678" />
        </Field>
        <Field label="メールアドレス">
          <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="例: info@example.com" />
        </Field>
        <Field label="所在地" className="md:col-span-2">
          <input name="address" value={formData.address} onChange={handleChange} className={inputClass} placeholder="例: 東京都新宿区..." />
        </Field>
        {isAdmin && (
          <Field label="担当チーム（team）" className="md:col-span-2">
            <input name="team" list="team-options" value={formData.team} onChange={handleChange} className={inputClass} placeholder="同じteamの営業アカウントに表示されます" />
            <datalist id="team-options">
              {teams.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        )}
      </form>
    </Modal>
  );
}

export function RecordFormModal({ onClose, onSave }: { onClose: () => void; onSave: (data: { date: string; title: string; content: string }) => Promise<void> }) {
  const [date, setDate] = useState(todayInput);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { saving, submit } = useSubmit(onSave);

  return (
    <Modal
      title="業務請負記録の追加"
      icon={FileText}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button type="submit" form="record-form" loading={saving} icon={Save}>
            追加する
          </Button>
        </>
      }
    >
      <form
        id="record-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit({ date, title, content });
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="日付" required>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="件名" required className="md:col-span-2">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="例: 〇〇工場 空撮業務" />
          </Field>
        </div>
        <Field label="内容">
          <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} className={inputClass} placeholder="作業内容、飛行時間、特記事項など" />
        </Field>
      </form>
    </Modal>
  );
}
