<script>
    import Title from "/src/components/Title.svelte";
</script>

<Title title="" />

<!-- cool content with cards and features of website-->

<div class="container mt-5">
    <div class="row">
        <div class="col-md-4 mb-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">📝 Бележки на картата</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Тук можете да видите бележките на картата за България.</p>
                </div>
                <div class="card-footer">
                    <a href="https://resultmaps.neis-one.org/osm-notes-country?c=Bulgaria" class="btn btn-outline-primary" target="_blank">Виж бележките <i class="bi bi-box-arrow-up-right"></i></a>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">💬 Дискусии под промени</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Тук можете да видите последните дискусии под промени за България.</p>
                </div>
                <div class="card-footer">
                    <a href="https://resultmaps.neis-one.org/osm-discussions?c=Bulgaria" class="btn btn-outline-primary" target="_blank">Виж дискусиите <i class="bi bi-box-arrow-up-right"></i></a>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">💭 Дискусионен форум</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Тук можете да видите дискусиите във форума за България.</p>
                </div>
                <div class="card-footer">
                    <a href="https://community.openstreetmap.org/c/communities/bg/75" class="btn btn-outline-primary" target="_blank">Виж дискусиите <i class="bi bi-box-arrow-up-right"></i></a>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">🔧 Инструменти за контрол на качеството</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Инструменти за контрол на качеството, който помагат за подобряване на данните в OpenStreetMap.</p>
                </div>
                <div class="card-footer">
                    <a href="/qa/" class="btn btn-outline-primary">Към инструментите</a>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">📋 Табличен редактор</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">Табличен редактор, който позволява лесно и бързо редактиране на данни в OpenStreetMap.</p>
                </div>
                <div class="card-footer">
                    <a href="/tEdit/" class="btn btn-outline-primary" >Очаквайте скоро</a>
                </div>
            </div>
        </div>
    </div>
</div>