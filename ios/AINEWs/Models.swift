import Foundation

struct NewsItem: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let summary: String?
    let source: Source
    let links: Links
    let publishedAt: String?
    let discoveredAt: String
    let category: String?
    let reason: String?

    struct Source: Codable, Equatable {
        let name: String
    }

    struct Links: Codable, Equatable {
        let aihot: String
        let original: String
    }

    var signature: String {
        [id, title, summary ?? "", reason ?? "", category ?? ""].joined(separator: "|")
    }
}

struct HotTopic: Codable, Identifiable, Equatable {
    let rank: Int
    let id: String
    let title: String
    let source: Source?
    let links: Links?
    let sourceCount: Int?

    struct Source: Codable, Equatable {
        let name: String?
    }

    struct Links: Codable, Equatable {
        let aihot: String?
        let original: String?
    }

    var signature: String {
        "\(rank)|\(id)|\(title)|\(sourceCount ?? 0)"
    }
}

struct ItemsEnvelope: Decodable {
    let items: [NewsItem]
}

struct TopicsEnvelope: Decodable {
    let items: [HotTopic]
}

enum NewsCategory: String, CaseIterable, Identifiable {
    case all = ""
    case models = "ai-models"
    case products = "ai-products"
    case industry = "industry"
    case paper = "paper"
    case tip = "tip"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "全部"
        case .models: "模型"
        case .products: "产品"
        case .industry: "行业"
        case .paper: "论文"
        case .tip: "教程"
        }
    }
}

func categoryLabel(_ category: String?) -> String {
    NewsCategory(rawValue: category ?? "")?.label ?? "动态"
}
