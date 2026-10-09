import SwiftUI

struct ContentView: View {
    @Bindable var store: NewsStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var category: NewsCategory = .all
    @State private var shareItem: NewsItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    categoryBar
                    if store.isLoading && store.items.isEmpty {
                        ProgressView("正在取今天的精选")
                            .frame(maxWidth: .infinity)
                            .padding(.top, 48)
                    } else if let errorMessage = store.errorMessage, store.items.isEmpty {
                        Text(errorMessage)
                            .font(.body)
                            .foregroundStyle(Palette.ink.opacity(0.7))
                            .padding(.top, 48)
                    } else {
                        if !store.topics.isEmpty && category == .all {
                            hotList
                        }
                        daySections
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .background(Palette.paper)
            .refreshable { await store.refresh() }
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await store.refresh()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                if Task.isCancelled { break }
                await store.refresh()
            }
        }
        .background {
            if let shareItem {
                ShareHost(item: shareItem) {
                    self.shareItem = nil
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("简")
                    .font(.system(size: 18, weight: .semibold, design: .serif))
                    .foregroundStyle(Palette.paper)
                    .frame(width: 36, height: 36)
                    .background(Palette.cinnabar)
                Text("团队 AI 简报")
                    .font(.system(size: 28, weight: .semibold, design: .serif))
                    .foregroundStyle(Palette.ink)
            }
            Text(statusLine)
                .font(.subheadline)
                .foregroundStyle(Palette.ink.opacity(0.55))
        }
        .padding(.top, 12)
    }

    private var statusLine: String {
        guard let lastChecked = store.lastChecked else {
            return "打开后每分钟核对一次，没有新内容就不改列表。"
        }
        let time = lastChecked.formatted(date: .omitted, time: .shortened)
        return "\(time) 核对过。没有新内容时，下面的列表保持不动。"
    }

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NewsCategory.allCases) { item in
                    Button {
                        category = item
                    } label: {
                        Text(item.label)
                            .font(.subheadline.weight(category == item ? .semibold : .regular))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(category == item ? Palette.ink : Palette.paper)
                            .foregroundStyle(category == item ? Palette.paper : Palette.ink)
                            .overlay {
                                Capsule().stroke(Palette.line, lineWidth: category == item ? 0 : 1)
                            }
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var hotList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("当前热点")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.cinnabar)
            ForEach(store.topics.prefix(8)) { topic in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(topic.rank)")
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                        .foregroundStyle(Palette.cinnabar)
                        .frame(width: 18, alignment: .leading)
                    Text(topic.title)
                        .font(.subheadline)
                        .foregroundStyle(Palette.ink)
                    Spacer(minLength: 8)
                    if let count = topic.sourceCount, count > 1 {
                        Text("\(count) 源")
                            .font(.caption)
                            .foregroundStyle(Palette.ink.opacity(0.45))
                    }
                }
            }
        }
    }

    private var daySections: some View {
        let groups = DayGroup.make(from: filteredItems)
        return VStack(alignment: .leading, spacing: 28) {
            if groups.isEmpty {
                Text("这个分类里暂时没有精选。")
                    .foregroundStyle(Palette.ink.opacity(0.6))
            }
            ForEach(groups) { group in
                VStack(alignment: .leading, spacing: 16) {
                    Text(group.title)
                        .font(.system(size: 20, weight: .semibold, design: .serif))
                    ForEach(group.items) { item in
                        NewsRow(item: item) {
                            shareItem = item
                        }
                    }
                }
            }
        }
    }

    private var filteredItems: [NewsItem] {
        guard category != .all else { return store.items }
        return store.items.filter { $0.category == category.rawValue }
    }
}

private struct NewsRow: View {
    let item: NewsItem
    let share: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(categoryLabel(item.category))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.moss)
                Text(item.source.name)
                    .font(.caption)
                    .foregroundStyle(Palette.ink.opacity(0.45))
                Spacer()
                Text(clock(item.discoveredAt))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Palette.ink.opacity(0.45))
            }
            Text(item.title)
                .font(.system(size: 20, weight: .semibold, design: .serif))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let summary = item.summary, !summary.isEmpty {
                Text(summary)
                    .font(.body)
                    .foregroundStyle(Palette.ink.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let reason = item.reason, !reason.isEmpty {
                Text(reason)
                    .font(.subheadline)
                    .foregroundStyle(Palette.moss)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 16) {
                if let url = URL(string: item.links.original) {
                    Link("原文", destination: url)
                }
                Button("分享卡片", action: share)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Palette.cinnabar)
            .padding(.top, 4)
        }
        .padding(.bottom, 8)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Palette.line).frame(height: 1)
        }
    }
}

struct DayGroup: Identifiable {
    let id: String
    let title: String
    let items: [NewsItem]

    static func make(from items: [NewsItem]) -> [DayGroup] {
        let calendar = shanghaiCalendar
        var order: [String] = []
        var buckets: [String: [NewsItem]] = [:]
        for item in items {
            let date = isoDate(item.discoveredAt) ?? .now
            let key = dayKey(date, calendar: calendar)
            if buckets[key] == nil { order.append(key) }
            buckets[key, default: []].append(item)
        }
        return order.map { key in
            let sample = isoDate(buckets[key]?.first?.discoveredAt ?? "") ?? .now
            return DayGroup(id: key, title: dayTitle(sample, calendar: calendar), items: buckets[key] ?? [])
        }
    }
}

func clock(_ iso: String) -> String {
    guard let date = isoDate(iso) else { return "" }
    return shanghaiFormat(date, "HH:mm")
}

func shanghaiStamp(_ iso: String) -> String {
    guard let date = isoDate(iso) else { return "" }
    return shanghaiFormat(date, "M月d日 HH:mm")
}

private func shanghaiFormat(_ date: Date, _ pattern: String) -> String {
    let formatter = DateFormatter()
    formatter.timeZone = TimeZone(identifier: "Asia/Shanghai")
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.dateFormat = pattern
    return formatter.string(from: date)
}

private func dayTitle(_ date: Date, calendar: Calendar) -> String {
    if calendar.isDateInToday(date) { return "今天 · \(weekday(date, calendar: calendar))" }
    if calendar.isDateInYesterday(date) { return "昨天 · \(weekday(date, calendar: calendar))" }
    return weekday(date, calendar: calendar)
}

private func weekday(_ date: Date, calendar: Calendar) -> String {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.dateFormat = "M月d日 EEE"
    return formatter.string(from: date)
}

private func dayKey(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return "\(parts.year ?? 0)-\(parts.month ?? 0)-\(parts.day ?? 0)"
}

func isoDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
}

var shanghaiCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Shanghai") ?? .current
    return calendar
}

enum Palette {
    static let paper = Color(red: 0.953, green: 0.933, blue: 0.894)
    static let ink = Color(red: 0.110, green: 0.090, blue: 0.078)
    static let cinnabar = Color(red: 0.624, green: 0.176, blue: 0.125)
    static let moss = Color(red: 0.247, green: 0.361, blue: 0.294)
    static let line = Color(red: 0.110, green: 0.090, blue: 0.078).opacity(0.12)
}
