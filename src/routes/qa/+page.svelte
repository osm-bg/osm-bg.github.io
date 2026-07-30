<script>
    import Title from "/src/components/Title.svelte";
    const cards = [
        {
            emoji: "🔍",
            title: "Интеграция на данни от AllThePlaces",
            text: "Инструмент за сравнение на данните в OpenStreetMap и на данните от AllThePlaces.",
            link: "./atp-osm/"
        },
        {
            emoji: "📏",
            title: "Километрични маркери",
            text: "Инструмент за сравнение показване на наличните данни за километрични маркери в OpenStreetMap.",
            link: "./motorway-milestones/"
        },
        {
            emoji: "🛣️",
            title: "Пътна мрежа",
            text: "Инструмент за визуализация на пътната мрежа в България, базирана на данни от OpenStreetMap.",
            link: "./road-network/"
        },
        {
            emoji: "🚂",
            title: "Железопътна мрежа",
            text: "Инструмент за визуализация на железопътната мрежа в България, базирана на данни от OpenStreetMap.",
            link: "./railway-network/"
        },
        {
            emoji: "💧",
            title: "Речна мрежа",
            text: "Инструмент за визуализация на речната мрежа в България, базирана на данни от OpenStreetMap.",
            link: "./river-network/"
        },
        {
            emoji: "🗑️",
            title: "Контейнери за отпадъци",
            text: "Инструмент за визуализация и проверка на данни за контейнери за отпадъци в OpenStreetMap.",
            link: "./waste-containers/"
        }
    ]
</script>

<Title title={false} />

<main class="container-fluid mt-3">
    <div class="d-flex flex-wrap gap-3 justify-content-center">
        {#each cards as card}
            <div class="">
                <div class="card" style="width: 18rem;">
                    <div class="card-body">
                        <h5 class="card-title">{card.emoji} {card.title}</h5>
                        <p class="card-text">{card.text}</p>
                        <a href={card.link} class="btn btn-outline-primary">Към инструмента</a>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</main>