"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUserStore } from "@/shared/store/userStore";
import {
  BACKEND_URL,
  getAdminStats,
  reloadModel,
  startRetrain,
  type AdminStats,
} from "@/shared/api/admin.api";
import { Button } from "@/shared/ui/Button/Button";
import styles from "./AdminPage.module.css";

type LogLine = { text: string; kind: "normal" | "error" | "best" | "success" | "fail" };

function classifyLog(line: string): LogLine["kind"] {
  if (line.includes("ERROR:")) return "error";
  if (line.includes("★ best")) return "best";
  return "normal";
}

const kindToStyle: Record<LogLine["kind"], string> = {
  normal: styles.logLine,
  error: `${styles.logLine} ${styles.logError}`,
  best: `${styles.logLine} ${styles.logBest}`,
  success: `${styles.logLine} ${styles.logSuccess}`,
  fail: `${styles.logLine} ${styles.logFail}`,
};

export const AdminPage: React.FC = () => {
  const accessToken = useUserStore((s) => s.accessToken);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDone, setStreamDone] = useState<"done" | "failed" | null>(null);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [withExport, setWithExport] = useState(true);
  const [epochs, setEpochs] = useState(50);
  const [diversityWeight, setDiversityWeight] = useState(0.1);

  const logRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getAdminStats());
      setStatsError(null);
    } catch {
      setStatsError("Не удалось загрузить статистику. Проверьте что AI-сервис запущен.");
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-scroll terminal
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, isStreaming]);

  const appendLog = (text: string, kind?: LogLine["kind"]) => {
    setLogs((prev) => [...prev, { text, kind: kind ?? classifyLog(text) }]);
  };

  const openLogStream = async () => {
    if (!accessToken) return;

    const resp = await fetch(`${BACKEND_URL}/admin/retrain/stream`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok || !resp.body) {
      appendLog("Не удалось открыть поток логов", "error");
      setIsStreaming(false);
      return;
    }

    const reader = resp.body.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              log?: string;
              status?: string;
              done?: boolean;
              error?: string;
            };
            if (payload.log) appendLog(payload.log);
            if (payload.error) appendLog(`Ошибка: ${payload.error}`, "error");
            if (payload.done) {
              const isDone = payload.status === "done";
              setStreamDone(isDone ? "done" : "failed");
              appendLog(
                isDone ? "── Обучение завершено ✓ ──" : "── Ошибка обучения ✗ ──",
                isDone ? "success" : "fail",
              );
              await loadStats();
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } finally {
      readerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleRetrain = async () => {
    setFormError(null);
    setLogs([]);
    setStreamDone(null);
    setIsStreaming(true);

    try {
      await startRetrain({ with_export: withExport, epochs, diversity_weight: diversityWeight });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Ошибка запуска обучения";
      setFormError(msg);
      setIsStreaming(false);
      return;
    }

    openLogStream();
  };

  const handleStop = () => {
    readerRef.current?.cancel();
  };

  const handleReload = async () => {
    setReloadMsg(null);
    try {
      const result = await reloadModel();
      setReloadMsg(`✓ ${result.status}`);
      await loadStats();
    } catch {
      setReloadMsg("✗ Ошибка перезагрузки");
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Управление моделью</h1>

      {/* Stats */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Статистика модели</h2>
        {statsError && <p className={styles.error}>{statsError}</p>}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Статус</span>
              <span className={`${styles.statValue} ${styles[`status_${stats.train_status}`]}`}>
                {stats.train_status}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Пользователей</span>
              <span className={styles.statValue}>{stats.registered_users}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Треков</span>
              <span className={styles.statValue}>{stats.num_tracks.toLocaleString("ru")}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Артистов</span>
              <span className={styles.statValue}>{stats.num_artists.toLocaleString("ru")}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Жанров</span>
              <span className={styles.statValue}>{stats.num_genres}</span>
            </div>
          </div>
        )}
        {stats?.last_log && (
          <p className={styles.logLine} style={{ margin: 0, fontSize: 12 }}>
            Последний лог: {stats.last_log}
          </p>
        )}
      </div>

      {/* Retrain */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Переобучение</h2>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={withExport}
                onChange={(e) => setWithExport(e.target.checked)}
              />
              Экспортировать свежие данные из БД перед обучением
            </label>
          </div>
          <div className={styles.formGroupSmall}>
            <label className={styles.label}>Эпохи</label>
            <input
              type="number"
              value={epochs}
              min={1}
              max={500}
              onChange={(e) => setEpochs(Number(e.target.value))}
              className={styles.input}
            />
          </div>
          <div className={styles.formGroupSmall}>
            <label className={styles.label}>
              Diversity λ = {diversityWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={diversityWeight}
              onChange={(e) => setDiversityWeight(Number(e.target.value))}
              style={{ accentColor: "var(--color-accent)", width: "100%" }}
              title="0 = без diversity loss, 1 = сильное разталкивание"
            />
          </div>
        </div>

        {formError && <p className={styles.error}>{formError}</p>}

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleRetrain} disabled={isStreaming}>
            {isStreaming ? "Обучение запущено..." : "Запустить обучение"}
          </Button>
          {isStreaming && (
            <Button variant="secondary" onClick={handleStop}>
              Остановить стрим
            </Button>
          )}
        </div>

        {(logs.length > 0 || isStreaming) && (
          <div className={styles.terminal} ref={logRef}>
            {logs.map((line, i) => (
              <div key={i} className={kindToStyle[line.kind]}>
                {line.text}
              </div>
            ))}
            {isStreaming && !streamDone && (
              <span className={styles.cursor}>▋</span>
            )}
          </div>
        )}
      </div>

      {/* Reload */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Перезагрузка весов</h2>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
          Загружает актуальный файл <code>user_encoder.pt</code> с диска без переобучения.
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleReload}>
            Перезагрузить модель
          </Button>
          {reloadMsg && (
            <span style={{ color: reloadMsg.startsWith("✓") ? "#78ff78" : "#ff6b6b", fontSize: 14 }}>
              {reloadMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
