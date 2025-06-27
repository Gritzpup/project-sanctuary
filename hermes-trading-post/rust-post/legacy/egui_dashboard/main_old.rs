//! BTC Trading Dashboard (egui/eframe)
//! - Displays logs and current price (placeholder)

use eframe::{egui, App, CreationContext};
use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use chrono::Local;

const MAX_LOG_ENTRIES: usize = 1000;

// --- Log entry structure ---
#[derive(Clone)]
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
}

// --- App state structure ---
#[derive(PartialEq)]
enum DashboardPage {
    Dashboard,
    BtcChart,
    Logs,
}

struct AppState {
    log_buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    current_price: Option<f64>,
    page: DashboardPage,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            log_buffer: Arc::new(RwLock::new(VecDeque::new())),
            current_price: None,
            page: DashboardPage::Dashboard,
        }
    }
}

impl AppState {
    fn log_println(&self, msg: &str) {
        let timestamp = Local::now().format("%H:%M:%S%.3f").to_string();
        let level = if msg.contains("ERROR") || msg.contains("❌") {
            "error"
        } else if msg.contains("WARN") || msg.contains("⚠️") {
            "warning"
        } else if msg.contains("SUCCESS") || msg.contains("✅") {
            "success"
        } else if msg.contains("DEBUG") || msg.contains("🔍") {
            "debug"
        } else {
            "info"
        };
        if let Ok(mut buffer) = self.log_buffer.write() {
            buffer.push_back(LogEntry {
                timestamp: timestamp.clone(),
                level: level.to_string(),
                message: msg.trim().to_string(),
            });
            while buffer.len() > MAX_LOG_ENTRIES {
                buffer.pop_front();
            }
        }
        println!("{}", msg);
    }

    fn clear_logs(&self) {
        if let Ok(mut buffer) = self.log_buffer.write() {
            buffer.clear();
        }
    }
}

impl App for AppState {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::SidePanel::left("sidebar").min_width(140.0).show(ctx, |ui| {
            ui.heading("BTC Dashboard");
            ui.separator();
            if ui.selectable_label(self.page == DashboardPage::Dashboard, "Dashboard").clicked() {
                self.page = DashboardPage::Dashboard;
            }
            if ui.selectable_label(self.page == DashboardPage::BtcChart, "BTC Chart").clicked() {
                self.page = DashboardPage::BtcChart;
            }
            if ui.selectable_label(self.page == DashboardPage::Logs, "Logs").clicked() {
                self.page = DashboardPage::Logs;
            }
        });
        egui::CentralPanel::default().show(ctx, |ui| {
            match self.page {
                DashboardPage::Dashboard => {
                    ui.heading("BTC Trading Dashboard");
                    if let Some(price) = self.current_price {
                        ui.label(format!("Current Price: ${:.2}", price));
                    } else {
                        ui.label("Current Price: --");
                    }
                    if ui.button("Clear Logs").clicked() {
                        self.clear_logs();
                    }
                    ui.separator();
                    ui.heading("Console Logs");
                    egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
                        if let Ok(buffer) = self.log_buffer.read() {
                            for entry in buffer.iter().rev() {
                                ui.colored_label(
                                    match entry.level.as_str() {
                                        "error" => egui::Color32::RED,
                                        "warning" => egui::Color32::YELLOW,
                                        "success" => egui::Color32::GREEN,
                                        "debug" => egui::Color32::LIGHT_BLUE,
                                        _ => egui::Color32::WHITE,
                                    },
                                    format!("[{}][{}] {}", entry.timestamp, entry.level, entry.message),
                                );
                            }
                        }
                    });
                }
                DashboardPage::BtcChart => {
                    use egui::plot::{Line, Plot, PlotPoints};
                    ui.heading("BTC Chart");
                    let points = PlotPoints::from_iter((0..100).map(|i| [i as f64, (i as f64 / 10.0).sin() * 50000.0 + 60000.0]));
                    let line = Line::new(points).name("BTC Price");
                    Plot::new("btc_chart_plot")
                        .height(400.0)
                        .width(600.0)
                        .show(ui, |plot_ui| {
                            plot_ui.line(line);
                        });
                }
                DashboardPage::Logs => {
                    ui.heading("Console Logs");
                    if ui.button("Clear Logs").clicked() {
                        self.clear_logs();
                    }
                    egui::ScrollArea::vertical().max_height(500.0).show(ui, |ui| {
                        if let Ok(buffer) = self.log_buffer.read() {
                            for entry in buffer.iter().rev() {
                                ui.colored_label(
                                    match entry.level.as_str() {
                                        "error" => egui::Color32::RED,
                                        "warning" => egui::Color32::YELLOW,
                                        "success" => egui::Color32::GREEN,
                                        "debug" => egui::Color32::LIGHT_BLUE,
                                        _ => egui::Color32::WHITE,
                                    },
                                    format!("[{}][{}] {}", entry.timestamp, entry.level, entry.message),
                                );
                            }
                        }
                    });
                }
            }
        });
    }
}

fn main() {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "BTC Trading Dashboard (egui)",
        options,
        Box::new(|_cc: &CreationContext| Box::new(AppState::default())),
    );
}