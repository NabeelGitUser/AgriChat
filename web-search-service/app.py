# ai_search.py
import ollama
import requests
from rich.console import Console
from rich.markdown import Markdown
from rich.spinner import Spinner
from rich.live import Live

console = Console()
SEARXNG_URL = "http://localhost:8081/search"
OLLAMA_MODEL = "gemma3:4b"  

def rewrite_query(user_query: str) -> str:
    """Use Ollama to rewrite query into better search terms."""
    response = ollama.chat(model=OLLAMA_MODEL, messages=[{
        "role": "user",
        "content": (
            f'Convert this into a concise web search query (return ONLY the query, nothing else):\n"{user_query}"'
        )
    }])
    return response["message"]["content"].strip().strip('"')


def search_web(query: str, num_results: int = 5) -> list[dict]:
    """Fetch results from SearXNG."""
    try:
        resp = requests.get(SEARXNG_URL, params={
            "q": query,
            "format": "json",
            "language": "en"
        }, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return results[:num_results]
    except Exception as e:
        console.print(f"[red]Search error: {e}[/red]")
        return []


def build_context(results: list[dict]) -> str:
    """Format search results as context for the LLM."""
    context = ""
    for i, r in enumerate(results, 1):
        title = r.get("title", "No title")
        content = r.get("content", "No snippet")
        url = r.get("url", "")
        context += f"[{i}] {title}\nURL: {url}\n{content}\n\n"
    return context.strip()


def synthesize_answer(user_query: str, context: str) -> str:
    """Use Ollama to generate a grounded answer from search results."""
    prompt = f"""You are a helpful AI search assistant.

Answer the following query using ONLY the search results provided.
Be concise, accurate, and cite sources using [1], [2], etc.

Query: {user_query}

Search Results:
{context}

Answer:"""

    response = ollama.chat(model=OLLAMA_MODEL, messages=[{
        "role": "user",
        "content": prompt
    }])
    return response["message"]["content"]


def print_sources(results: list[dict]):
    console.print("\n[bold cyan]Sources:[/bold cyan]")
    for i, r in enumerate(results, 1):
        console.print(f"  [dim][{i}][/dim] {r.get('title', 'N/A')} - [blue]{r.get('url', '')}[/blue]")


def main():
    console.print("[bold green]🔍 AI Web Search (powered by Ollama + SearXNG)[/bold green]")
    console.print("[dim]Type 'exit' or 'quit' to stop.[/dim]\n")

    while True:
        try:
            user_query = console.input("[bold yellow]Search:[/bold yellow] ").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Bye![/dim]")
            break

        if not user_query:
            continue
        if user_query.lower() in ("exit", "quit"):
            console.print("[dim]Bye![/dim]")
            break

        # Step 1: Rewrite query
        with Live(Spinner("dots", text="Rewriting query..."), refresh_per_second=10):
            search_query = rewrite_query(user_query)
        console.print(f"[dim]Search query: {search_query}[/dim]")

        # Step 2: Search
        with Live(Spinner("dots", text="Searching the web..."), refresh_per_second=10):
            results = search_web(search_query)

        if not results:
            console.print("[red]No results found. Try a different query.[/red]\n")
            continue

        # Step 3: Synthesize
        context = build_context(results)
        with Live(Spinner("dots", text="Generating answer..."), refresh_per_second=10):
            answer = synthesize_answer(user_query, context)

        # Output
        console.print("\n[bold white]Answer:[/bold white]")
        console.print(Markdown(answer))
        print_sources(results)
        console.print()


if __name__ == "__main__":
    main()